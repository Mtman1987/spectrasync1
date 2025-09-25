import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getLiveVipUsers } from '@/app/actions';

export const dynamic = 'force-dynamic';
import { getRuntimeValue } from '@/lib/runtime-config';
import { sanitizeForLog } from '@/lib/sanitize';

async function validateBotSecret(request: NextRequest) {
  const secret = request.headers.get('x-bot-secret') || request.nextUrl.searchParams.get('secret');
  const expected = await getRuntimeValue<string>('BOT_SECRET_KEY');
  return secret === expected;
}

function buildVipEmbed(vip: any) {
  return {
    author: { 
      name: vip.displayName, 
      icon_url: vip.avatarUrl, 
      url: `https://twitch.tv/${vip.twitchLogin}` 
    },
    title: vip.latestStreamTitle || 'Live Stream',
    url: `https://twitch.tv/${vip.twitchLogin}`,
    description: `*${vip.vipMessage || 'Come hang out and watch the stream!'}*`,
    color: 0x9146FF,
    fields: [
      { name: 'Playing', value: vip.latestGameName || 'Just Chatting', inline: true },
      { name: 'Viewers', value: vip.latestViewerCount.toString(), inline: true }
    ],
    thumbnail: { url: vip.avatarUrl },
    timestamp: new Date().toISOString()
  };
}

async function postToDiscord(webhookUrl: string, payload: any) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.ok ? await response.json() : null;
}

async function editDiscordMessage(webhookUrl: string, messageId: string, payload: any) {
  const response = await fetch(`${webhookUrl}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.ok;
}

async function deleteDiscordMessage(webhookUrl: string, messageId: string) {
  const response = await fetch(`${webhookUrl}/messages/${messageId}`, {
    method: 'DELETE'
  });
  return response.ok;
}

async function processGuild(guildId: string) {
  const db = await getAdminDb();
  
  const settingsDoc = await db.collection(`communities/${guildId}/settings`).doc('vipLive').get();
  if (!settingsDoc.exists) return null;
  
  const config = settingsDoc.data()!;
  const webhookUrl = config.webhookUrl;
  let messageIds: { [twitchId: string]: string } = config.vipMessageIds || {};
  
  if (!webhookUrl) return null;
  
  const liveVips = await getLiveVipUsers(guildId);
  const liveVipIds = new Set(liveVips.map(v => v.twitchId));
  const postedVipIds = new Set(Object.keys(messageIds));
  const newMessages: { [twitchId: string]: string } = {};
  
  for (const twitchId of postedVipIds) {
    if (!liveVipIds.has(twitchId)) {
      await deleteDiscordMessage(webhookUrl, messageIds[twitchId]);
    }
  }
  
  for (const vip of liveVips) {
    const embed = buildVipEmbed(vip);
    const payload = { embeds: [embed] };
    
    if (messageIds[vip.twitchId]) {
      const success = await editDiscordMessage(webhookUrl, messageIds[vip.twitchId], payload);
      if (success) {
        newMessages[vip.twitchId] = messageIds[vip.twitchId];
      }
    } else {
      const message = await postToDiscord(webhookUrl, payload);
      if (message?.id) {
        newMessages[vip.twitchId] = message.id;
      }
    }
  }
  
  await db.collection(`communities/${guildId}/settings`).doc('vipLive').set(
    { vipMessageIds: newMessages }, 
    { merge: true }
  );
  
  return { liveVipCount: liveVips.length };
}

export async function GET(request: NextRequest) {
  try {
    if (!await validateBotSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = await getAdminDb();
    const communitiesSnapshot = await db.collection('communities').get();
    
    if (communitiesSnapshot.empty) {
      return NextResponse.json({ success: true, message: 'No communities to process' });
    }
    
    let totalLiveVips = 0;
    const results = [];
    
    for (const communityDoc of communitiesSnapshot.docs) {
      const guildId = communityDoc.id;
      console.log(`Processing VIP Live for guild: ${sanitizeForLog(guildId)}`);
      
      const result = await processGuild(guildId);
      if (result) {
        totalLiveVips += result.liveVipCount;
        results.push({ guildId, liveVips: result.liveVipCount });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} guilds with ${totalLiveVips} live VIPs`,
      results
    });
    
  } catch (error) {
    console.error('VIP Live cron error:', sanitizeForLog(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}