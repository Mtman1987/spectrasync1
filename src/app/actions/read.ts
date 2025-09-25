'use server';

import { getAdminDb } from "@/lib/firebase-admin";
import { getTwitchStreams } from "@/lib/twitch";
import type { LiveUser } from "@/app/raid-pile/types";

export async function getRaidPile(guildId: string): Promise<LiveUser[]> {
  const db = await getAdminDb();
  const pileSnapshot = await db.collection('communities').doc(guildId).collection('raidPile').orderBy('joinedAt', 'asc').get();
  const pileUsers = pileSnapshot.docs.map(doc => doc.data() as { twitchId: string, displayName: string, avatarUrl: string, twitchLogin: string });

  if (pileUsers.length === 0) return [];

  const liveStreams = await getTwitchStreams(pileUsers.map(u => u.twitchId));
  const liveStreamMap = new Map(liveStreams.map(s => [s.user_id, s]));

  return pileUsers
    .filter(u => liveStreamMap.has(u.twitchId))
    .map(u => {
      const stream = liveStreamMap.get(u.twitchId)!;
      return {
        ...u,
        latestGameName: stream.game_name,
        latestStreamTitle: stream.title,
        latestViewerCount: stream.viewer_count,
        started_at: stream.started_at,
      };
    })
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
}

export async function getRaidTrain(guildId: string) {
    const db = await getAdminDb();
    const scheduleSnapshot = await db.collection('communities').doc(guildId).collection('raidTrain').doc('schedule').get();
    if (!scheduleSnapshot.exists) {
        return { schedule: [] };
    }
    return scheduleSnapshot.data() as { schedule: Array<{ dayOfWeek: string, slots: Array<{ time: string, claimedBy?: { displayName: string }, note?: string }> }> };
}

export async function getCommunityPoolVips(guildId: string) {
    const db = await getAdminDb();
    const usersSnapshot = await db.collection('communities').doc(guildId).collection('users').where('communityPoolOptIn', '==', true).get();
    const poolUsers = usersSnapshot.docs.map(doc => doc.data() as { twitchId: string, displayName: string, avatarUrl: string, twitchLogin: string });

    if (poolUsers.length === 0) {
        return { live: [], lastSpotlightedId: null };
    }

    const liveStreams = await getTwitchStreams(poolUsers.map(u => u.twitchId));
    const liveStreamMap = new Map(liveStreams.map(s => [s.user_id, s]));

    const live = poolUsers
        .filter(u => liveStreamMap.has(u.twitchId))
        .map(u => {
            const stream = liveStreamMap.get(u.twitchId)!;
            return {
                ...u,
                latestGameName: stream.game_name,
                latestStreamTitle: stream.title,
                latestViewerCount: stream.viewer_count,
                started_at: stream.started_at,
            };
        });

    const settingsSnapshot = await db.collection('communities').doc(guildId).collection('settings').doc('communityPoolConfig').get();
    const lastSpotlightedId = settingsSnapshot.exists ? settingsSnapshot.data()?.lastSpotlightedId : null;

    return { live, lastSpotlightedId };
}

export interface RaidTrainData {
    schedule: Array<{
        dayOfWeek: string;
        slots: Array<{ time: string; claimedBy?: { displayName: string }; note?: string }>;
    }>;
}