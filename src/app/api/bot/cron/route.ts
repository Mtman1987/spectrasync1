// src/app/api/bot/cron/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getTwitchStreams } from '@/app/actions';
import { postToWebhook, editWebhookMessage, deleteWebhookMessage } from '@/bot/discord-actions';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { generateVipShoutout } from '@/ai/flows/generate-vip-shoutout';
import { getUsersFromDb } from '@/app/actions';

// --- Types ---
type LiveUser = {
  twitchId: string;
  twitchLogin: string;
  displayName: string;
  avatarUrl: string;
  latestGameName: string;
  latestViewerCount: number;
  latestStreamTitle?: string;
  vipMessage?: string;
  started_at?: string;
  discordId?: string; // Ensure discordId is available
  vipMessageLastGenerated?: Timestamp;
};

// --- Firestore Helpers ---

async function getVipTwitchIds(guildId: string): Promise<string[]> {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const db = await getAdminDb();
    const snapshot = await db.collection(`communities/${guildId}/users`).where('isVip', '==', true).get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data().twitchInfo?.id).filter(Boolean);
}

// --- Discord Embed Builders ---

function buildVipEmbed(vip: LiveUser, gifUrl: string | null) {
    const embed = {
        author: { name: vip.displayName, icon_url: vip.avatarUrl, url: `https://twitch.tv/${vip.twitchLogin}` },
        title: vip.latestStreamTitle || 'Untitled Stream',
        url: `https://twitch.tv/${vip.twitchLogin}`,
        description: `*${vip.vipMessage || 'Come hang out!'}*`,
        color: 0x9146FF, // Twitch Purple
        fields: [
            { name: 'Playing', value: vip.latestGameName || 'N/A', inline: true },
            { name: 'Viewers', value: vip.latestViewerCount.toString(), inline: true }
        ],
        thumbnail: { url: vip.avatarUrl },
        timestamp: new Date().toISOString(),
        image: gifUrl ? { url: gifUrl } : undefined
    };
        
    return embed;
}

// --- Main Bot Logic ---

async function processVip(guildId: string, vip: LiveUser, webhookUrl: string, existingMessageId?: string) {
    let gifUrl: string | null = null;
    let processedVip = { ...vip };

    try {
        // AI Shoutout Generation with 24-hour cooldown
        const now = Date.now();
        const lastGenerated = vip.vipMessageLastGenerated?.toMillis() || 0;
        const shouldGenerateMessage = !vip.vipMessage || (now - lastGenerated > 24 * 60 * 60 * 1000);

        if (shouldGenerateMessage && vip.discordId) {
            try {
                const shoutoutResult = await generateVipShoutout({ vipName: vip.displayName });
                processedVip.vipMessage = shoutoutResult.shoutoutMessage;

                // Update the database with the new message and timestamp
                const { getAdminDb } = await import('@/lib/firebase-admin');
                const db = await getAdminDb();
                const userRef = db.collection(`communities/${guildId}/users`).doc(vip.discordId);
                await userRef.update({
                    vipMessage: processedVip.vipMessage,
                    vipMessageLastGenerated: FieldValue.serverTimestamp()
                });

            } catch (aiError) {
                console.error(`AI message generation failed for ${vip.displayName}:`, aiError);
                // Fallback to existing message if generation fails
                processedVip.vipMessage = vip.vipMessage || 'Come hang out and watch the stream!';
            }
        }


        // GIF Selection
        if (vip.discordId) {
            const { getAdminDb } = await import('@/lib/firebase-admin');
            const db = await getAdminDb();
            const gifsSnapshot = await db.collection(`communities/${guildId}/users/${vip.discordId}/generatedGifs`).get();
            if (!gifsSnapshot.empty) {
                const gifs = gifsSnapshot.docs.map(doc => doc.data().gifUrl);
                gifUrl = gifs[Math.floor(Math.random() * gifs.length)];
            }
        }
    } catch (error) {
        console.error(`Could not fetch GIFs or generate message for ${vip.displayName}:`, error);
    }
        
    const embed = buildVipEmbed(processedVip, gifUrl);
    const payload = { embeds: [embed] };

    if (existingMessageId) {
        await editWebhookMessage(webhookUrl, existingMessageId, payload);
        return existingMessageId;
    } else {
        const message = await postToWebhook(webhookUrl, payload);
        return message ? message.id : null;
    }
}


async function runVipCheckForGuild(guildId: string) {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const db = await getAdminDb();
    const settingsDoc = await db.collection(`communities/${guildId}/settings`).doc('vipLive').get();
    if (!settingsDoc.exists) {
        console.log(`[Cron] No VIP config for guild ${guildId}. Skipping.`);
        return;
    }
    const config = settingsDoc.data()!;
    const webhookUrl = config.webhookUrl;
    let messageIds: { [twitchId: string]: string } = config.vipMessageIds || {};

    if (!webhookUrl) {
        console.log(`[Cron] No webhook URL for guild ${guildId}. Skipping.`);
        return;
    }

    const vipTwitchIds = await getVipTwitchIds(guildId);
    if (vipTwitchIds.length === 0) {
        // If no VIPs are configured, delete all old messages.
        if (Object.keys(messageIds).length > 0) {
            for (const messageId of Object.values(messageIds)) {
                await deleteWebhookMessage(webhookUrl, messageId);
            }
            await db.collection(`communities/${guildId}/settings`).doc('vipLive').set({ vipMessageIds: {} }, { merge: true });
        }
        return;
    }
    
    const [dbUsers, liveStreams] = await Promise.all([
        getUsersFromDb(guildId, vipTwitchIds),
        getTwitchStreams(vipTwitchIds)
    ]);

    const liveStreamMap = new Map(liveStreams.map(s => [s.user_id, s]));

    const liveVips: LiveUser[] = dbUsers
        .map(user => {
            const streamData = liveStreamMap.get(user.twitchId);
            if (!streamData) return null;
            return { ...user, ...streamData, latestGameName: streamData.game_name, latestViewerCount: streamData.viewer_count, latestStreamTitle: streamData.title };
        })
        .filter((u): u is LiveUser => u !== null);

    const liveVipIds = new Set(liveVips.map(v => v.twitchId));
    const postedVipIds = new Set(Object.keys(messageIds));
    const newMessages: { [twitchId: string]: string } = {};

    // Delete messages for VIPs who went offline
    for (const twitchId of postedVipIds) {
        if (!liveVipIds.has(twitchId)) {
            await deleteWebhookMessage(webhookUrl, messageIds[twitchId]);
        }
    }

    // Process live VIPs (add new ones, update existing ones)
    for (const vip of liveVips) {
        const newMessageId = await processVip(guildId, vip, webhookUrl, messageIds[vip.twitchId]);
        if (newMessageId) {
            newMessages[vip.twitchId] = newMessageId;
        }
    }

    // Persist the new state of message IDs
    await db.collection(`communities/${guildId}/settings`).doc('vipLive').set({ vipMessageIds: newMessages }, { merge: true });
    
    return { liveVipCount: liveVips.length };
}


/**
 * This is the main entry point for the cron job.
 * It will iterate through all configured communities and run the VIP check.
 */
export async function GET(request: NextRequest) {
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const db = await getAdminDb();
    const communitiesSnapshot = await db.collection('communities').get();
    if (communitiesSnapshot.empty) {
      return NextResponse.json({ success: true, message: 'No communities to process.' });
    }

    let totalLiveVips = 0;
    const results = [];

    for (const communityDoc of communitiesSnapshot.docs) {
        const guildId = communityDoc.id;
        console.log(`[Cron] Processing guild: ${guildId}`);
        const result = await runVipCheckForGuild(guildId);
        if (result) {
            totalLiveVips += result.liveVipCount;
            results.push({ guildId, liveVips: result.liveVipCount });
        }
    }

    return NextResponse.json({
      success: true,
      message: `Cron job completed. Processed ${communitiesSnapshot.size} guilds. Found ${totalLiveVips} live VIPs.`,
      details: results
    });

  } catch (error) {
    console.error('Cron job failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}