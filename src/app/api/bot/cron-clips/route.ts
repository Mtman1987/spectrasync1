'use server';
// src/app/api/bot/cron-clips/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getTwitchClips, getClipById } from '@/app/actions';
import { generateGifFromUrl } from '@/ai/flows/generate-gif';
import { FieldValue } from 'firebase-admin/firestore';
import { sanitizeForLog } from '@/lib/sanitize';

async function processClipsForGuild(guildId: string) {
    const db = await getAdminDb();
    const usersSnapshot = await db.collection(`communities/${guildId}/users`).where('isVip', '==', true).get();
    if (usersSnapshot.empty) {
        console.log(`[Clip Cron] No VIPs found for guild ${guildId}.`);
        return { processed: 0, newGifs: 0 };
    }

    let newGifCount = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const twitchId = userData.twitchInfo?.id;

        if (!twitchId) continue;

        try {
            const recentClips = await getTwitchClips(twitchId, 5);
            const gifsRef = userDoc.ref.collection('generatedGifs');

            for (const clip of recentClips) {
                const clipDocRef = gifsRef.doc(clip.id);
                const clipDoc = await clipDocRef.get();

                // If we haven't processed this clip before
                if (!clipDoc.exists) {
                    console.log(`[Clip Cron] New clip found for ${userData.twitchInfo.displayName}: ${clip.id}`);
                    const clipDetails = await getClipById(clip.id);

                    if (clipDetails?.video_url) {
                        const gifResult = await generateGifFromUrl({
                            videoUrl: clipDetails.video_url,
                            videoDuration: clipDetails.duration
                        });
                        
                        if (gifResult.gifUrl) {
                            await clipDocRef.set({
                                gifUrl: gifResult.gifUrl,
                                originalClipUrl: clip.url,
                                clipTitle: clip.title,
                                createdAt: FieldValue.serverTimestamp()
                            });
                            newGifCount++;
                            console.log(`[Clip Cron] Successfully generated and saved GIF for clip ${clip.id}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`[Clip Cron] Error processing clips for user ${userData.twitchInfo.displayName} (ID: ${twitchId}):`, error);
        }
    }
    return { processed: usersSnapshot.size, newGifs: newGifCount };
}


/**
 * This is the entry point for the clip generation cron job.
 * It will iterate through all configured communities and process clips for VIPs.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getAdminDb();
    const communitiesSnapshot = await db.collection('communities').get();
    if (communitiesSnapshot.empty) {
      return NextResponse.json({ success: true, message: 'No communities to process.' });
    }

    const allResults = [];
    for (const communityDoc of communitiesSnapshot.docs) {
        const guildId = communityDoc.id;
        console.log(`[Clip Cron] Processing guild: ${sanitizeForLog(guildId)}`);
        const result = await processClipsForGuild(guildId);
        allResults.push({ guildId, ...result });
    }

    return NextResponse.json({
      success: true,
      message: `Clip cron job completed. Processed ${communitiesSnapshot.size} guilds.`,
      details: allResults
    });

  } catch (error) {
    console.error('Clip cron job failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
