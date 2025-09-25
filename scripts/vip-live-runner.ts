#!/usr/bin/env tsx
import 'dotenv/config';
import { setTimeout as wait } from 'timers/promises';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const { fetch } = globalThis as typeof globalThis & { fetch: typeof fetch };

// ---------- Firebase bootstrap ----------
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

if (!firebaseProjectId) {
  console.warn('FIREBASE_PROJECT_ID not in env; relying on default credentials');
}

const firebaseConfig = firebaseClientEmail && firebasePrivateKeyRaw
  ? {
      credential: cert({
        projectId: firebaseProjectId,
        clientEmail: firebaseClientEmail,
        privateKey: firebasePrivateKeyRaw.replace(/\n/g, '
'),
      }),
    }
  : { credential: applicationDefault() };

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ---------- Runtime config helpers ----------
const RUNTIME_DOC_COLLECTION = 'app_settings';
const RUNTIME_DOC_ID = 'runtime';

type RuntimeConfig = Record<string, unknown> & {
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  TWITCH_BOT_REFRESH_TOKEN?: string;
  TWITCH_BOT_TOKEN?: string;
  TWITCH_BOT_TOKEN_EXPIRES_AT?: string;
  DISCORD_BOT_TOKEN?: string;
  VIP_CHANNEL_ID?: string;
  FREECONVERT_TOKEN?: string;
  POLL_INTERVAL_MS?: number;
  VIP_GUILD_ID?: string;
  STOCK_GIFS?: string | string[];
};

async function getRuntimeConfig(): Promise<RuntimeConfig> {
  const snap = await db.collection(RUNTIME_DOC_COLLECTION).doc(RUNTIME_DOC_ID).get();
  if (!snap.exists) {
    throw new Error('Runtime config (app_settings/runtime) not found. Run scripts/upload-env.ps1 first.');
  }
  return snap.data() as RuntimeConfig;
}

async function mergeRuntimeConfig(patch: Record<string, unknown>) {
  await db.collection(RUNTIME_DOC_COLLECTION).doc(RUNTIME_DOC_ID).set(
    { ...patch, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

// ---------- Twitch token helpers ----------
function isoPlusSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function refreshUserToken(config: RuntimeConfig): Promise<string> {
  const clientId = config.TWITCH_CLIENT_ID;
  const clientSecret = config.TWITCH_CLIENT_SECRET;
  const refreshToken = config.TWITCH_BOT_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Twitch client credentials or refresh token in runtime config.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const resp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(`Failed to refresh Twitch user token: ${JSON.stringify(json)}`);
  }

  const accessToken = json.access_token as string;
  const newRefresh = (json.refresh_token as string | undefined) ?? refreshToken;
  const expires = typeof json.expires_in === 'number' ? isoPlusSeconds(json.expires_in) : undefined;

  await mergeRuntimeConfig({
    TWITCH_BOT_TOKEN: accessToken,
    TWITCH_BOT_REFRESH_TOKEN: newRefresh,
    TWITCH_BOT_TOKEN_EXPIRES_AT: expires,
  });

  config.TWITCH_BOT_TOKEN = accessToken;
  config.TWITCH_BOT_REFRESH_TOKEN = newRefresh;
  config.TWITCH_BOT_TOKEN_EXPIRES_AT = expires;

  return accessToken;
}

async function ensureUserToken(config: RuntimeConfig): Promise<string> {
  const token = config.TWITCH_BOT_TOKEN;
  const expiresAt = config.TWITCH_BOT_TOKEN_EXPIRES_AT;
  if (token && expiresAt) {
    const expiresMs = Date.parse(expiresAt);
    if (!Number.isNaN(expiresMs) && expiresMs - Date.now() > 60_000) {
      return token;
    }
  }
  return refreshUserToken(config);
}

async function getAppAccessToken(config: RuntimeConfig): Promise<string> {
  const clientId = config.TWITCH_CLIENT_ID;
  const clientSecret = config.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing Twitch client credentials in runtime config.');
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  const resp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(`Failed to obtain Twitch app token: ${JSON.stringify(json)}`);
  }
  return json.access_token as string;
}

// ---------- Twitch helpers ----------
async function getUserByLogin(login: string, clientId: string, token: string) {
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, {
    headers: {
      'Client-Id': clientId,
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Twitch users lookup failed: ${JSON.stringify(json)}`);
  }
  return Array.isArray(json.data) ? json.data[0] : undefined;
}

async function getStreamsByUsers(logins: string[], clientId: string, token: string) {
  if (logins.length === 0) return [];
  const qs = new URLSearchParams();
  for (const login of logins) {
    qs.append('user_login', login);
  }
  const res = await fetch(`https://api.twitch.tv/helix/streams?${qs.toString()}`, {
    headers: {
      'Client-Id': clientId,
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Twitch streams lookup failed: ${JSON.stringify(json)}`);
  }
  return Array.isArray(json.data) ? json.data : [];
}

async function getLatestClipForBroadcasterId(broadcasterId: string, clientId: string, userToken: string) {
  const res = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=5`, {
    headers: {
      'Client-Id': clientId,
      Authorization: `Bearer ${userToken}`,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Twitch clips lookup failed: ${JSON.stringify(json)}`);
  }
  return Array.isArray(json.data) ? json.data[0] : undefined;
}

async function resolveClipMp4(clipUrl: string | null | undefined) {
  if (!clipUrl) return null;
  if (clipUrl.includes('clips-media-assets')) return clipUrl;
  try {
    const resp = await fetch(clipUrl, { redirect: 'follow' });
    if (resp.url && resp.url.endsWith('.mp4')) {
      return resp.url;
    }
  } catch (err) {
    console.warn('resolveClipMp4 failed:', err);
  }
  return null;
}

// ---------- FreeConvert helpers ----------
async function importToFreeConvert(mediaUrl: string, token: string) {
  const res = await fetch('https://api.freeconvert.com/v1/process/import/url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: mediaUrl, filename: 'clip.mp4' }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`FreeConvert import failed: ${JSON.stringify(json)}`);
  }
  return json.id ?? json;
}

async function createFreeConvertJob(importId: string, token: string, opts: Record<string, unknown>) {
  const jobBody = {
    tasks: {
      'convert-1': {
        operation: 'convert',
        input: importId,
        input_format: 'mp4',
        output_format: 'gif',
        options: {
          cut_start_video_to_gif: opts.start ?? '00:00:00.00',
          cut_end_gif: opts.end ?? '00:01:00.00',
          video_custom_width_gif: opts.width ?? 480,
          loop_count_video_to_gif: 0,
          gif_fps: opts.fps ?? '12',
          video_to_gif_compression: opts.compression ?? '70',
        },
      },
      'export-1': {
        operation: 'export/url',
        input: ['convert-1'],
        filename: opts.filename ?? 'preview',
      },
    },
  };
  const res = await fetch('https://api.freeconvert.com/v1/process/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(jobBody),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`FreeConvert job creation failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function pollFreeConvertJob(jobId: string, token: string, timeoutMs = 120_000, intervalMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const json = await res.json();
    if (json.status === 'finished') {
      const tasks = json.tasks ?? {};
      const exportTask = Object.values(tasks).find((task: any) => task?.operation === 'export/url');
      const url = exportTask?.result?.files?.[0]?.url as string | undefined;
      if (url) return url;
      break;
    }
    if (json.status === 'failed') {
      throw new Error(`FreeConvert job failed: ${JSON.stringify(json)}`);
    }
    await wait(intervalMs);
  }
  throw new Error('FreeConvert job poll timeout');
}

// ---------- Firestore VIP helpers ----------
function vipUsersCollection(guildId: string) {
  return db.collection('communities').doc(guildId).collection('users');
}

function vipClipCollection(guildId: string, login: string) {
  return db.collection('communities').doc(guildId).collection('vipLiveCache').doc(login).collection('clips');
}

async function fetchVipLogins(guildId: string): Promise<string[]> {
  const snapshot = await vipUsersCollection(guildId).where('isVip', '==', true).get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const login = data.twitchLogin ?? data.twitchInfo?.login ?? doc.id;
      return login ? String(login).toLowerCase() : null;
    })
    .filter((value): value is string => Boolean(value));
}

async function cacheClipForVIP(guildId: string, vipLogin: string, clipMeta: Record<string, unknown>) {
  await vipClipCollection(guildId, vipLogin).doc(String(clipMeta.clipId)).set(
    {
      ...clipMeta,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );
}

async function getCachedClipsForVIP(guildId: string, vipLogin: string) {
  const snapshot = await vipClipCollection(guildId, vipLogin)
    .orderBy('updatedAt', 'desc')
    .limit(10)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

// ---------- Discord helper ----------
async function postToDiscord(channelId: string, botToken: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Discord API error ${res.status}: ${await res.text()}`);
  }
}

// ---------- Embed builder ----------
function buildEmbedForVIP(vipLogin: string, gifUrl: string, streamData: Record<string, any>) {
  const title = streamData.title ?? 'Live Now';
  const startedAt = streamData.started_at ?? new Date().toISOString();
  const profileImage =
    streamData.profile_image_url ?? 'https://cdn.discordapp.com/embed/avatars/0.png';
  const streamUrl = streamData.stream_url ?? `https://www.twitch.tv/${vipLogin}`;
  const game = streamData.game_name ?? 'Unknown';

  return {
    content: `**??? Transmission from Space Mountain**
${vipLogin} is live now?crew morale is high and the cosmic vibes are flowing!`,
    embeds: [
      {
        title: `?? Expedition: ${title}`,
        description: `> ?? **${vipLogin} Broadcast**: Streaming **${game}** ? join the orbit, lift spirits, and vibe with the crew.`,
        timestamp: startedAt,
        color: 0xffa500,
        footer: {
          text: 'Powered by Cosmic Crew ? All systems nominal',
          icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
        },
        author: {
          name: `?? ${vipLogin} Goes Galactic!`,
          url: streamUrl,
          icon_url: profileImage,
        },
        image: { url: gifUrl },
        thumbnail: { url: profileImage },
        fields: [
          { name: '?? Chat Commands', value: '`!boost`, `!shoutout`, `!warp`', inline: true },
          { name: '?? Loot Drops', value: 'Cosmic crates every 30 mins', inline: true },
          {
            name: '?? Signal Strength',
            value: streamData.viewer_count ? `Viewers: ${streamData.viewer_count}` : 'High',
            inline: true,
          },
        ],
      },
    ],
  };
}

// ---------- Core processing ----------
async function finalizeAndPost(
  guildId: string,
  vipLogin: string,
  discordChannelId: string,
  discordBotToken: string,
  streamData: Record<string, any>,
  clipContext: {
    gifUrl?: string | null;
    clipMeta?: Record<string, unknown> | null;
    stockPool: string[];
  },
) {
  const { gifUrl, clipMeta, stockPool } = clipContext;

  const tryPost = async (url: string, source: string) => {
    const payload = buildEmbedForVIP(vipLogin, url, streamData);
    await postToDiscord(discordChannelId, discordBotToken, payload);
    console.log(`[VIP] Posted embed for ${vipLogin} (${source}) -> ${url}`);
  };

  if (gifUrl) {
    if (clipMeta) {
      await cacheClipForVIP(guildId, vipLogin, {
        ...clipMeta,
        gifUrl,
        timestamp: new Date().toISOString(),
      });
    }
    await tryPost(gifUrl, 'generated');
    return;
  }

  const cached = await getCachedClipsForVIP(guildId, vipLogin);
  if (cached.length > 0) {
    const choice = cached[Math.floor(Math.random() * cached.length)];
    const url = choice.gifUrl ?? choice.mp4Url;
    if (url) {
      await tryPost(url, 'cache');
      return;
    }
  }

  const fallback = stockPool[Math.floor(Math.random() * stockPool.length)];
  await tryPost(fallback, 'fallback');
}

async function processVip(
  guildId: string,
  vipLogin: string,
  config: RuntimeConfig,
  discordChannelId: string,
  discordBotToken: string,
  freeconvertToken: string,
  appToken: string,
  userToken: string,
  stockPool: string[],
) {
  const clientId = config.TWITCH_CLIENT_ID!;
  try {
    const user = await getUserByLogin(vipLogin, clientId, appToken);
    if (!user) {
      console.warn(`[VIP] Twitch user not found: ${vipLogin}`);
      return;
    }

    const streams = await getStreamsByUsers([vipLogin], clientId, appToken);
    const stream = streams.find((s: any) => s.user_login?.toLowerCase() === vipLogin.toLowerCase());
    const streamData = {
      title: stream?.title ?? user.description ?? 'Live Broadcast',
      game_name: stream?.game_name ?? 'Unknown',
      started_at: stream?.started_at ?? new Date().toISOString(),
      profile_image_url: user.profile_image_url,
      stream_url: `https://www.twitch.tv/${vipLogin}`,
      viewer_count: stream?.viewer_count ?? null,
    };

    if (!stream) {
      console.log(`[VIP] ${vipLogin} is offline; skipping.`);
      return;
    }

    const clip = await getLatestClipForBroadcasterId(user.id, clientId, userToken);
    const mp4Url = clip ? await resolveClipMp4(clip.url) : null;

    if (clip && mp4Url) {
      const cutEnd = clip.duration ? secondsToTimestamp(Math.ceil(clip.duration)) : '00:01:00.00';
      try {
        const importId = await importToFreeConvert(mp4Url, freeconvertToken);
        const jobResp = await createFreeConvertJob(importId.id ?? importId, freeconvertToken, {
          end: cutEnd,
          width: 480,
          fps: '12',
          filename: `${vipLogin}-preview`,
        });
        const jobId = jobResp.id ?? jobResp?.data?.id ?? jobResp?.data?.job?.id;
        if (!jobId) throw new Error('Missing FreeConvert job id in response');
        const gifUrl = await pollFreeConvertJob(jobId, freeconvertToken, 120_000, 3000);
        await finalizeAndPost(guildId, vipLogin, discordChannelId, discordBotToken, streamData, {
          gifUrl,
          clipMeta: {
            clipId: clip.id,
            clipUrl: clip.url,
            mp4Url,
            duration: clip.duration,
          },
          stockPool,
        });
        return;
      } catch (err) {
        console.warn(`[VIP] Conversion failed for ${vipLogin}:`, err);
      }
    }

    await finalizeAndPost(guildId, vipLogin, discordChannelId, discordBotToken, streamData, {
      gifUrl: null,
      clipMeta: clip
        ? {
            clipId: clip.id,
            clipUrl: clip.url,
            mp4Url,
            duration: clip.duration,
          }
        : null,
      stockPool,
    });
  } catch (err) {
    console.error(`[VIP] processVip error for ${vipLogin}:`, err);
    await finalizeAndPost(guildId, vipLogin, discordChannelId, discordBotToken, {
      title: 'Live broadcast',
      started_at: new Date().toISOString(),
      profile_image_url: undefined,
      stream_url: `https://www.twitch.tv/${vipLogin}`,
    }, {
      gifUrl: null,
      clipMeta: null,
      stockPool,
    });
  }
}

function secondsToTimestamp(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.00`;
}

async function runOnce(config: RuntimeConfig) {
  const guildId = config.VIP_GUILD_ID ?? config.DEFAULT_GUILD_ID ?? process.env.VIP_GUILD_ID;
  if (!guildId) {
    throw new Error('VIP_GUILD_ID is not set in runtime config or environment.');
  }

  const discordBotToken = config.DISCORD_BOT_TOKEN ?? process.env.DISCORD_BOT_TOKEN;
  const vipChannelId = config.VIP_CHANNEL_ID ?? process.env.VIP_CHANNEL_ID;
  if (!discordBotToken || !vipChannelId) {
    throw new Error('Missing Discord bot token or VIP channel id in runtime config.');
  }

  const freeconvertToken = config.FREECONVERT_TOKEN ?? process.env.FREECONVERT_TOKEN;
  if (!freeconvertToken) {
    throw new Error('Missing FreeConvert token in runtime config.');
  }

  const stockGifPoolRaw = config.STOCK_GIFS ?? process.env.STOCK_GIFS;
  const stockPool = Array.isArray(stockGifPoolRaw)
    ? stockGifPoolRaw as string[]
    : typeof stockGifPoolRaw === 'string'
      ? stockGifPoolRaw.split(',').map((v) => v.trim()).filter(Boolean)
      : [
          'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
          'https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif',
          'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
        ];

  const appToken = await getAppAccessToken(config);
  const userToken = await ensureUserToken(config);

  const vipLogins = await fetchVipLogins(guildId);
  if (vipLogins.length === 0) {
    console.log('[VIP] No VIPs to process.');
    return;
  }

  const clientId = config.TWITCH_CLIENT_ID!;
  const streams = await getStreamsByUsers(vipLogins, clientId, appToken);
  const liveLogins = new Set(streams.map((s: any) => String(s.user_login).toLowerCase()));

  console.log(`[VIP] Processing ${vipLogins.length} VIPs. Live now: ${liveLogins.size}`);

  for (const vipLogin of vipLogins) {
    if (!liveLogins.has(vipLogin.toLowerCase())) {
      console.log(`[VIP] ${vipLogin} is offline; skipping.`);
      continue;
    }
    await processVip(
      guildId,
      vipLogin,
      config,
      vipChannelId,
      discordBotToken,
      freeconvertToken,
      appToken,
      userToken,
      stockPool,
    );
    await wait(1500);
  }
}

async function mainLoop() {
  const config = await getRuntimeConfig();
  const pollMs = Number(config.POLL_INTERVAL_MS ?? process.env.POLL_INTERVAL_MS ?? 420_000);
  console.log('[VIP] Starting VIP live automation loop. Interval:', pollMs, 'ms');
  while (true) {
    try {
      await runOnce(config);
    } catch (err) {
      console.error('[VIP] runOnce error:', err);
    }
    console.log(`[VIP] Sleeping for ${(pollMs / 1000).toFixed(0)} seconds...`);
    await wait(pollMs);
    // refresh config for next cycle in case credentials changed
    Object.assign(config, await getRuntimeConfig());
  }
}

mainLoop().catch((err) => {
  console.error('Fatal error in VIP live runner:', err);
  process.exit(1);
});
