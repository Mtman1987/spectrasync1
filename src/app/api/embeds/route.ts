import { NextResponse, type NextRequest } from "next/server";
import { format } from "date-fns";

import { buildCalendarEmbed } from "@/app/calendar/actions";
import { buildLeaderboardEmbed } from "@/app/leaderboard/actions";
import { getLiveVipUsers, getTwitchClips } from "@/app/actions";
import { deleteDiscordMessages, validateBotSecret } from "@/lib/bot-utils";
import { getAdminDb } from "@/lib/firebase-admin";
import type { LiveUser } from "@/app/raid-pile/types";

interface EmbedRequestPayload extends Record<string, unknown> {
  type: string;
  guildId: string;
  channelId?: string;
  header?: string;
  headerTitle?: string;
  headerMessage?: string;
  maxEmbedsPerMessage?: number;
  vipId?: string;
  vipLogin?: string;
  dispatch?: boolean;
}

type EmbedResponsePayload = Record<string, unknown> | null;

interface VipEmbedResponse extends Record<string, unknown> {
  feature: string;
  guildId: string;
  totalVips: number;
  lastUpdatedAt: string;
  refreshHintSeconds: number;
  maxEmbedsPerMessage: number;
  header?: { title?: string | null; message?: string | null };
  messages?: MessageBlock[];
}

type EmbedBuilder = (payload: EmbedRequestPayload) => Promise<EmbedResponsePayload>;
type EmbedObject = Record<string, unknown>;

type MessageBlock = {
  index: number;
  embeds: EmbedObject[];
  metadata: {
    chunk: number;
    totalChunks: number;
    feature: string;
    guildId: string;
    lastUpdatedAt: string;
  };
};

type ClipPreview = {
  sourceClipUrl: string | null;
  gifUrl: string | null;
  note?: string | null;
};

type DispatchSummary =
  | { status: "skipped"; reason?: string }
  | { status: "sent"; count: number; messageIds: string[] }
  | { status: "error"; error: string };

const VIP_REFRESH_SECONDS = 7 * 60;
const DISCORD_MAX_EMBEDS = 10;
const MAX_VIP_CARDS = 100;
const DISCORD_API_BASE = process.env.DISCORD_API_BASE_URL ?? "https://discord.com/api/v10";
const VIP_LIVE_CONFIG_DOC_ID = "vipLiveConfig";

function normalizePayload(rawPayload: unknown): EmbedRequestPayload | null {
  if (!rawPayload || typeof rawPayload !== "object") {
    return null;
  }

  let working = rawPayload as Record<string, unknown>;
  if (
    "root" in working &&
    working.root &&
    typeof working.root === "object" &&
    !Array.isArray(working.root)
  ) {
    working = working.root as Record<string, unknown>;
  }

  const typeValue =
    typeof working.type === "string"
      ? working.type
      : typeof working.feature === "string"
      ? working.feature
      : undefined;

  const guildIdValue =
    typeof working.guildId === "string"
      ? working.guildId
      : typeof working.communityId === "string"
      ? working.communityId
      : undefined;

  if (!typeValue || !guildIdValue) {
    return null;
  }

  const normalized: EmbedRequestPayload = {
    ...(working as EmbedRequestPayload),
    type: typeValue,
    guildId: guildIdValue,
  };

  return normalized;
}

const embedBuilders: Record<string, EmbedBuilder> = {
  calendar: async ({ guildId }) => buildCalendarEmbed(guildId),
  leaderboard: async ({ guildId }) => buildLeaderboardEmbed(guildId),
  "vip-live": buildVipLiveEmbed,
  vip: buildVipLiveEmbed,
  "community-pool": buildUnsupported("community pool"),
  community: buildUnsupported("community pool"),
  "raid-pile": buildUnsupported("raid pile"),
  pile: buildUnsupported("raid pile"),
  "raid-train": buildUnsupported("raid train"),
}

function buildUnsupported(feature: string): EmbedBuilder {
  return async () => ({
    feature,
    embeds: [
      {
        title: `${feature} embed coming soon`,
        description: `The ${feature} embed has not been implemented yet.`,
        color: 0xff5555,
        timestamp: new Date().toISOString(),
      },
    ],
    components: [],
  });
}

function formatStartedAt(iso?: string) {
  if (!iso) {
    return "just now";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  try {
    return format(date, "h:mm a");
  } catch {
    return "just now";
  }
}

function chunkEmbeds(embeds: EmbedObject[], maxPerMessage: number) {
  const messages: EmbedObject[][] = [];
  let current: EmbedObject[] = [];

  for (const embed of embeds) {
    if (current.length >= maxPerMessage) {
      messages.push(current);
      current = [];
    }
    current.push(embed);
  }

  if (current.length > 0) {
    messages.push(current);
  }

  return messages;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Add this helper function at the top of your file or in a shared utils file.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates a GIF preview for a Twitch clip of a VIP using the FreeConvert API.
 * It fetches the latest clip for the VIP, generates a GIF, and caches the result.
 *
 * @param vip The VIP user object. Must contain `twitchId` and `displayName`.
 * @returns A promise that resolves to a ClipPreview object.
 */
async function getClipPreview(vip: LiveUser): Promise<ClipPreview> {
  try {
    // 1. Fetch the latest clip from Twitch
    const clips = await getTwitchClips(vip.twitchId, 1);
    if (!clips || !clips.length) {
      return { sourceClipUrl: null, gifUrl: null, note: "No recent clips found." };
    }
    const clip = clips[0];
    const username = vip.displayName;

    // 2. Check cache (using Firestore)
    const db = await getAdminDb();
    const cacheRef = db.collection("gifPreviews").doc(clip.id);
    const cacheDoc = await cacheRef.get();
    if (cacheDoc.exists) {
      const data = cacheDoc.data();
      if (data?.gifUrl) {
        console.log(`[Cache HIT] Using cached GIF for clip ${clip.id}`);
        return {
          sourceClipUrl: `https://clips.twitch.tv/${clip.id}`,
          gifUrl: data.gifUrl,
          note: "from cache",
        };
      }
    }

    console.log(`[Cache MISS] Generating new GIF for clip ${clip.id} for user ${username}`);

    if (!process.env.FREE_CONVERT_API_KEY) {
      return { sourceClipUrl: null, gifUrl: null, note: "FreeConvert API key missing." };
    }

    // 3. Construct the MP4 URL from the Twitch clip's thumbnail URL or use any available video url.
    let mp4Url: string | null = null;
    if (typeof (clip as any).video_url === "string" && (clip as any).video_url.trim()) {
      mp4Url = (clip as any).video_url;
    } else if (typeof clip.thumbnail_url === "string" && clip.thumbnail_url.trim()) {
      // Try the common Twitch pattern first
      mp4Url = clip.thumbnail_url.replace(/-preview-\d+x\d+\.jpg$/, ".mp4");
      // If the replacement didn't change the string, try a more permissive fallback
      if (mp4Url === clip.thumbnail_url) {
        mp4Url = clip.thumbnail_url.replace(/\.jpg$/, ".mp4");
      }
    }

    if (!mp4Url) {
      return { sourceClipUrl: null, gifUrl: null, note: "Unable to derive MP4 URL for the clip." };
    }

    // 4. Define the job payload for the FreeConvert API.
    const jobPayload = {
      tasks: {
        "import-url": { operation: "import/url", url: mp4Url },
        "convert-gif": {
          operation: "convert",
          input: "import-url",
          input_format: "mp4",
          output_format: "gif",
          options: {
            video_custom_width_gif: 400,
            gif_fps: "15",
            video_to_gif_compression: "80",
            video_to_gif_optimize_static_bg: false,
            video_to_gif_transparency: false,
          },
        },
        "export-url": {
          operation: "export/url",
          input: ["convert-gif"],
          filename: `${clip.id}-preview.gif`,
        },
      },
    };

    // 5. Create the job on FreeConvert.
    const createJobResponse = await fetch("https://api.freeconvert.com/v1/process/jobs", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.FREE_CONVERT_API_KEY}`
      },
      body: JSON.stringify(jobPayload)
    });

    if (!createJobResponse.ok) {
      const errorText = await createJobResponse.text();
      throw new Error(`FreeConvert job creation failed with status ${createJobResponse.status}: ${errorText}`);
    }

  const job = await createJobResponse.json();
  const jobId = job?.id ?? job?.job?.id;
    console.log(`Started FreeConvert job ${jobId} for clip ${clip.id}`);

    // 6. Poll for job completion.
    const maxRetries = 24; // Poll for a maximum of 24 * 5 = 120 seconds.
    for (let i = 0; i < maxRetries; i++) {
      await sleep(5000); // Wait 5 seconds between polls.

      const statusResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobId}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.FREE_CONVERT_API_KEY}`,
        }
      });

      if (!statusResponse.ok) {
        console.warn(`Failed to get job status for ${jobId} (status: ${statusResponse.status}), retrying...`);
        continue;
      }

      const jobStatus = await statusResponse.json();

      if (jobStatus.status === "completed") {
        // Tasks may be returned as an array or keyed object depending on the response shape.
        const tasks = jobStatus.tasks ?? {};
        const tasksArray = Array.isArray(tasks) ? tasks : Object.values(tasks);

        // Try to find an export task that contains a usable URL in a few possible shapes.
        const exportTask = tasksArray.find((task: any) => {
          return (
            task?.name === "export-url" ||
            task?.operation?.toString().includes("export") ||
            Boolean(task?.result?.url) ||
            Boolean(task?.result?.files?.[0]?.url)
          );
        });

        const gifUrl =
          exportTask?.result?.url ??
          exportTask?.result?.files?.[0]?.url ??
          exportTask?.result?.files?.[0]?.url_secure ??
          null;

        if (gifUrl) {
          // 7. Cache the result and return.
          await cacheRef.set({ gifUrl, createdAt: new Date().toISOString() });
          console.log(`Successfully generated and cached GIF for clip ${clip.id}`);
          return {
            sourceClipUrl: `https://clips.twitch.tv/${clip.id}`,
            gifUrl: gifUrl,
            note: null,
          };
        }

        throw new Error(`FreeConvert job ${jobId} completed, but no export URL was found (unexpected task shape).`);
      }

      if (jobStatus.status === "failed") {
        const tasks = jobStatus.tasks ?? {};
        const tasksArray = Array.isArray(tasks) ? tasks : Object.values(tasks);
        const failedTask = tasksArray.find((t: any) => t?.status === "failed");
        const reason = failedTask?.result?.message ?? jobStatus?.error ?? "Unknown reason";
        throw new Error(`FreeConvert job ${jobId} failed: ${reason}`);
      }
    }

    throw new Error(`FreeConvert job ${jobId} timed out after ${maxRetries * 5} seconds.`);
  } catch (error) {
    console.error(`Error creating clip preview for ${vip.displayName}:`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { sourceClipUrl: null, gifUrl: null, note: `Failed to generate GIF: ${message}` };
  }
}

function pickVipTarget(liveVips: LiveUser[], payload: EmbedRequestPayload) {
  const requestedId = typeof payload.vipId === "string" ? payload.vipId : undefined;
  const requestedLogin =
    typeof payload.vipLogin === "string" ? payload.vipLogin.toLowerCase() : undefined;

  const matchById = requestedId
    ? liveVips.find((vip) => vip.twitchId === requestedId || vip.twitchLogin === requestedId)
    : undefined;
  if (matchById) {
    return matchById;
  }

  if (requestedLogin) {
    const match = liveVips.find((vip) => vip.twitchLogin?.toLowerCase() === requestedLogin);
    if (match) {
      return match;
    }
  }

  return liveVips[0];
}

function pickVipOrdering(liveVips: LiveUser[], payload: EmbedRequestPayload) {
  const primary = pickVipTarget(liveVips, payload);
  if (!primary) {
    return [...liveVips];
  }
  return [primary, ...liveVips.filter((vip) => vip !== primary)];
}

async function buildVipLiveEmbed(payload: EmbedRequestPayload): Promise<EmbedResponsePayload> {
  const guildId = payload.guildId;
  if (!guildId) {
    return null;
  }

  const liveVips = await getLiveVipUsers(guildId);
  const now = new Date();
  const isoNow = now.toISOString();
  const formattedTimestamp = format(now, "MMM d, yyyy h:mm a");

  const rawPayload = payload as Record<string, unknown>;
  const headerCandidates = [
    typeof rawPayload.headerMessage === "string" ? rawPayload.headerMessage : undefined,
    typeof rawPayload.message === "string" ? rawPayload.message : undefined,
    typeof rawPayload.header === "string" ? rawPayload.header : undefined,
  ];

  const headerMessage =
    (headerCandidates.find((value) => typeof value === "string" && value.trim().length) as
      | string
      | undefined)?.trim() ??
    "Our VIPs keep the community adventurous and thriving. Drop in, cheer them on, and help the crew grow!";

  const headerTitleCandidate =
    typeof rawPayload.headerTitle === "string" ? rawPayload.headerTitle.trim() : "";
  const headerTitle = headerTitleCandidate.length > 0 ? headerTitleCandidate : "VIP Live Lounge";

  let maxEmbedsPerMessage = DISCORD_MAX_EMBEDS;
  if (typeof rawPayload.maxEmbedsPerMessage === "number") {
    const coerced = Math.floor(rawPayload.maxEmbedsPerMessage);
    if (Number.isFinite(coerced) && coerced >= 1) {
      maxEmbedsPerMessage = Math.min(DISCORD_MAX_EMBEDS, coerced);
    }
  }

  const headerEmbed: EmbedObject = {
    title: headerTitle,
    description: headerMessage,
    color: 0xa970ff,
    timestamp: isoNow,
  };

  const ordered = liveVips.length ? pickVipOrdering(liveVips, payload) : [];
  const cardEmbeds: EmbedObject[] = [];
  const cardsMeta: Array<Record<string, unknown>> = [];

  if (!ordered.length) {
    cardEmbeds.push({
      description: "No VIPs are live right now. Check back soon for more community adventures!",
      color: 0x5865f2,
      timestamp: isoNow,
    });
  } else {
    const vipsToProcess = ordered.slice(0, MAX_VIP_CARDS);

    // Fetch all clip previews in parallel
    const clipPreviews = await Promise.all(vipsToProcess.map((vip) => getClipPreview(vip)));

    vipsToProcess.forEach((vip, index) => {
      const viewerCount = typeof vip.latestViewerCount === "number" ? vip.latestViewerCount : 0;
      const startedAtText = formatStartedAt(vip.started_at);
      const clipPreview = clipPreviews[index]; // Use the fetched preview

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: "Streaming", value: vip.latestGameName || "N/A", inline: true },
        { name: "Viewers", value: `${viewerCount}`, inline: true },
      ];

      if (vip.vipMessage && vip.vipMessage.trim().length > 0) {
        fields.push({ name: "VIP Message", value: vip.vipMessage.trim(), inline: false });
      }

      const embed: EmbedObject = {
        title: `${index + 1}. ${vip.displayName}`,
        url: vip.twitchLogin ? `https://twitch.tv/${vip.twitchLogin}` : undefined,
        description: vip.latestStreamTitle || "Streaming now!",
        color: index === 0 ? 0x9146ff : 0x4864ff,
        fields,
        thumbnail: vip.avatarUrl ? { url: vip.avatarUrl } : undefined,
        footer: { text: `Live since ${startedAtText}` },
        timestamp: isoNow,
      };

      // Add the GIF to the embed if we got one
      if (clipPreview.gifUrl) {
        embed.image = { url: clipPreview.gifUrl };
      }

      // If there's a note (e.g., an error), add it to the footer for debugging.
      // Access the existing footer text safely (EmbedObject is a loose Record),
      // then replace the footer with a new object containing the combined text.
      if (clipPreview.note) {
        const existingFooterText =
          embed.footer && typeof embed.footer === "object" && "text" in embed.footer && typeof (embed.footer as any).text === "string"
            ? (embed.footer as any).text
            : "";

        embed.footer = {
          ...(embed.footer as Record<string, unknown>),
          text: `${existingFooterText}${existingFooterText ? " • " : ""}${clipPreview.note}`,
        };
      }

      cardEmbeds.push(embed);

      cardsMeta.push({
        rank: index + 1,
        displayName: vip.displayName,
        twitchLogin: vip.twitchLogin,
        latestGameName: vip.latestGameName ?? null,
        latestStreamTitle: vip.latestStreamTitle ?? null,
        latestViewerCount: typeof vip.latestViewerCount === "number" ? vip.latestViewerCount : null,
        startedAt: vip.started_at ?? null,
        vipMessage: vip.vipMessage ?? null,
        clip: clipPreview,
      });
    });

    if (ordered.length > MAX_VIP_CARDS) {
      const remaining = ordered.length - MAX_VIP_CARDS;
      cardEmbeds.push({
        description: `+${remaining} additional VIP${remaining === 1 ? "" : "s"} are live.`,
        color: 0x9146ff,
        timestamp: isoNow,
      });
    }
  }

  const footerLines: string[] = [`Last update: ${formattedTimestamp}`, "Updates ~7m"];
  if (typeof rawPayload.channelId === "string" && rawPayload.channelId.trim().length > 0) {
    footerLines.push(`Channel: <#${rawPayload.channelId.trim()}>`);
  }

  const footerEmbed: EmbedObject = {
    color: 0x5865f2,
    description: footerLines.join(" • "),
    timestamp: isoNow,
  };

  const allEmbeds = [headerEmbed, ...cardEmbeds, footerEmbed];
  const messages = chunkEmbeds(allEmbeds, maxEmbedsPerMessage).map<MessageBlock>((chunk, index, all) => ({
    index,
    embeds: chunk,
    metadata: {
      chunk: index + 1,
      totalChunks: all.length,
      feature: "vip-live",
      guildId,
      lastUpdatedAt: isoNow,
    },
  }));

  return {
    feature: "vip-live",
    guildId,
    totalVips: liveVips.length,
    lastUpdatedAt: isoNow,
    refreshHintSeconds: VIP_REFRESH_SECONDS,
    maxEmbedsPerMessage,
    header: {
      title: headerTitle,
      message: headerMessage,
    },
    cards: cardsMeta,
    messages,
  };
}

async function dispatchMessagesToDiscord(messages: MessageBlock[], channelId: string) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    throw new Error("DISCORD_BOT_TOKEN is not configured.");
  }

  const userAgent = process.env.DISCORD_USER_AGENT ?? "SpectraSyncBot/1.0 (+https://spectrasync.app)";
  const ids: string[] = [];

  for (const block of messages) {
    const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify({ embeds: block.embeds }),
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const errorMessage = typeof payload?.message === "string" ? payload.message : text;
      throw new Error(`Discord API error (${response.status}): ${errorMessage}`);
    }

    if (typeof payload?.id === "string") {
      ids.push(payload.id);
    }

    if (messages.length > 1) {
      await delay(250);
    }
  }

  return ids;
}

async function persistVipLiveConfig(
  payload: EmbedRequestPayload,
  responsePayload: EmbedResponsePayload,
  dispatchSummary: DispatchSummary,
) {
  try {
    if (!payload.guildId) {
      return;
    }

    const db = await getAdminDb();
    const settingsRef = db
      .collection("communities")
      .doc(payload.guildId)
      .collection("settings")
      .doc(VIP_LIVE_CONFIG_DOC_ID);

    const normalizedChannelId =
      typeof payload.channelId === "string" && payload.channelId.trim().length > 0
        ? payload.channelId.trim()
        : "";
    const dispatchEnabled = Boolean(payload.dispatch && normalizedChannelId);

    if (!dispatchEnabled && !normalizedChannelId && payload.dispatch === false) {
      await settingsRef.delete();
      return;
    }

    const response = (responsePayload ?? {}) as VipEmbedResponse;
    const headerFromResponse = response.header ?? {};

    const data = {
      guildId: payload.guildId,
      channelId: normalizedChannelId || null,
      headerTitle: payload.headerTitle ?? headerFromResponse.title ?? null,
      headerMessage: payload.headerMessage ?? headerFromResponse.message ?? null,
      maxEmbedsPerMessage: payload.maxEmbedsPerMessage ?? response.maxEmbedsPerMessage ?? null,
      refreshHintSeconds: response.refreshHintSeconds ?? VIP_REFRESH_SECONDS,
      lastUpdatedAt: response.lastUpdatedAt ?? new Date().toISOString(),
      dispatchEnabled,
      updatedAt: new Date().toISOString(),
      lastDispatchStatus: dispatchSummary.status,
      lastDispatchMessageIds:
        dispatchSummary.status === "sent" ? dispatchSummary.messageIds ?? [] : [],
    };

    await settingsRef.set(data, { merge: true });
  } catch (error) {
    console.error("Failed to persist VIP live embed configuration", error);
  }
}

async function getVipLiveConfig(guildId: string): Promise<{ lastDispatchMessageIds?: string[] } | null> {
  if (!guildId) {
    return null;
  }
  try {
    const db = await getAdminDb();
    const docRef = db
      .collection("communities")
      .doc(guildId)
      .collection("settings")
      .doc(VIP_LIVE_CONFIG_DOC_ID);
    const doc = await docRef.get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as { lastDispatchMessageIds?: string[] };
  } catch (error) {
    console.error("Failed to retrieve VIP live embed configuration", error);
    return null;
  }
}

async function handleEmbedRequest(request: NextRequest) {
  try {
    const secretStatus = await validateBotSecret(request);
    if (!secretStatus.valid) {
      return NextResponse.json({ error: "Unauthorized", reason: secretStatus.reason }, { status: 401 });
    }

    let rawPayload: unknown;
    if (request.method === "POST") {
      try {
        rawPayload = await request.json();
      } catch (error) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    } else {
      // GET
      const query = request.nextUrl.searchParams;
      const queryObject: Record<string, unknown> = {};
      for (const [key, value] of query.entries()) {
        if (value === "true") {
          queryObject[key] = true;
        } else if (value === "false") {
          queryObject[key] = false;
        } else if (!isNaN(Number(value)) && value.trim() !== "") {
          queryObject[key] = Number(value);
        } else {
          queryObject[key] = value;
        }
      }
      rawPayload = queryObject;
    }

    const payload = normalizePayload(rawPayload);
    if (!payload) {
      return NextResponse.json(
        { error: "Missing required field: type or guildId" },
        { status: 400 },
      );
    }

    const normalizedType = payload.type.toLowerCase();
    const builder = embedBuilders[normalizedType];
    if (!builder) {
      return NextResponse.json({ error: `Unsupported embed type: ${payload.type}` }, { status: 400 });
    }

    const responsePayload = await builder(payload);
    if (!responsePayload) {
      return NextResponse.json({ error: "Failed to generate embed payload" }, { status: 500 });
    }

    let statusCode = 200;
    let dispatchSummary: DispatchSummary = { status: "skipped" };

    if (payload.dispatch === true) {
      if (!payload.channelId || typeof payload.channelId !== "string" || !payload.channelId.trim()) {
        return NextResponse.json(
          { error: "channelId is required when dispatch is enabled" },
          { status: 400 },
        );
      }

      const maybeMessages = (responsePayload as Record<string, unknown>).messages;
      if (!Array.isArray(maybeMessages) || maybeMessages.length === 0) {
        dispatchSummary = { status: "skipped", reason: "No messages to dispatch" };
      } else {
        try {
          const config = await getVipLiveConfig(payload.guildId);
          const oldMessageIds = config?.lastDispatchMessageIds ?? [];

          if (oldMessageIds.length > 0) {
            console.log(
              `Deleting ${oldMessageIds.length} old VIP live messages from channel ${payload.channelId}.`,
            );
            await deleteDiscordMessages(payload.channelId, oldMessageIds);
          }

          const messageIds = await dispatchMessagesToDiscord(
            maybeMessages as MessageBlock[],
            payload.channelId,
          );
          dispatchSummary = {
            status: "sent",
            count: messageIds.length,
            messageIds,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown Discord dispatch error";
          console.error("Failed to dispatch VIP embed to Discord", error);
          dispatchSummary = { status: "error", error: message };
          statusCode = 502;
        }
      }
    }

    await persistVipLiveConfig(payload, responsePayload, dispatchSummary);

    return NextResponse.json(
      {
        ...(responsePayload ?? {}),
        dispatch: dispatchSummary,
      },
      { status: statusCode },
    );
  } catch (error) {
    console.error(`Error in /api/embeds route (${request.method}):`, error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleEmbedRequest(request);
}

export async function GET(request: NextRequest) {
  return handleEmbedRequest(request);
}
