import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

const DISCORD_API_BASE = process.env.DISCORD_API_BASE_URL ?? "https://discord.com/api/v10";

const SECRET_PLACEHOLDERS = new Set([
  "your-super-secret-key-that-you-share-with-your-bot",
  "changeme",
  "placeholder",
]);

function shouldEnforceSecret(secretValue: string | undefined | null) {
  if (!secretValue) return false;
  const normalized = secretValue.trim().toLowerCase();
  return normalized.length > 0 && !SECRET_PLACEHOLDERS.has(normalized);
}

function validateSecret(request: NextRequest) {
  const expectedSecret = process.env.BOT_SECRET_KEY;
  if (!shouldEnforceSecret(expectedSecret)) return { valid: true };

  let providedSecret = request.headers.get("x-bot-secret") ?? request.headers.get("authorization");
  if (!providedSecret && request.method === "GET") {
    providedSecret = request.nextUrl.searchParams.get("secret");
  }

  if (!providedSecret) return { valid: false };
  if (providedSecret === expectedSecret) return { valid: true };
  if (providedSecret.toLowerCase().startsWith("bearer ")) {
    const token = providedSecret.slice(7).trim();
    if (token === expectedSecret) return { valid: true };
  }
  return { valid: false };
}

async function deleteDiscordMessages(channelId: string, messageIds: string[]) {
  if (messageIds.length === 0) return;

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) throw new Error("DISCORD_BOT_TOKEN is not configured.");

  const userAgent = process.env.DISCORD_USER_AGENT ?? "SpectraSyncBot/1.0 (+https://spectrasync.app)";

  if (messageIds.length === 1) {
    const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageIds[0]}`, {
      method: "DELETE",
      headers: { Authorization: `Bot ${botToken}`, "User-Agent": userAgent },
    });
    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      console.warn(`Failed to delete single Discord message ${messageIds[0]}: ${text}`);
    }
    return;
  }

  // Bulk delete (up to 100)
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/bulk-delete`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({ messages: messageIds.slice(0, 100) }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.warn(`Discord bulk delete failed (status ${response.status}): ${text}`);
  }
}

// Map external feature identifiers to Firestore settings document IDs
const FEATURE_TO_CONFIG_ID: Record<string, string> = {
  "vip-live": "vipLiveConfig",
  "community-pool": "communityPoolConfig",
  "raid-train": "raidTrainConfig",
  "raid-pile": "raidPileConfig",
};

export async function POST(request: NextRequest) {
  try {
    const secretStatus = validateSecret(request);
    if (!secretStatus.valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let raw: unknown;
    try {
      raw = await request.json();
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Support payload wrapped in `root`
    const body = raw && typeof raw === "object" && "root" in (raw as Record<string, unknown>)
      ? (raw as any).root
      : (raw as Record<string, unknown>);

    const feature = typeof body?.feature === "string" ? body.feature : undefined;
    const guildId = typeof body?.guildId === "string" ? body.guildId : undefined;
    const channelIdFromRequest = typeof body?.channelId === "string" ? body.channelId : undefined;

    if (!feature || !guildId) {
      return NextResponse.json({ error: "Missing required fields: feature and guildId" }, { status: 400 });
    }

    const normalized = feature.toLowerCase();
    const configId = FEATURE_TO_CONFIG_ID[normalized];
    if (!configId) {
      return NextResponse.json({ error: `Unsupported feature: ${feature}` }, { status: 400 });
    }

    const db = await getAdminDb();
    const settingsRef = db.collection("communities").doc(guildId).collection("settings").doc(configId);
    const doc = await settingsRef.get();

    if (!doc.exists) {
      // Still respond success (idempotent); nothing to delete but ensure config is disabled
      await settingsRef.set({ dispatchEnabled: false, channelId: null, lastDispatchMessageIds: [] }, { merge: true });
      return NextResponse.json({ status: "disabled", reason: "No existing config; disabled" });
    }

    const data = doc.data() as Record<string, unknown>;
    const channelId = channelIdFromRequest ?? (typeof data.channelId === "string" ? data.channelId : undefined);
    const messageIds = Array.isArray(data.lastDispatchMessageIds) ? data.lastDispatchMessageIds.filter((id) => typeof id === "string") : [];

    if (channelId && messageIds.length > 0) {
      try {
        await deleteDiscordMessages(channelId, messageIds as string[]);
      } catch (err) {
        console.error("Failed to delete discord messages for disable-feature", err);
        // continue to disable config even if deletion fails
      }
    }

    // Disable dispatch and clear message ids/channel
    await settingsRef.set({ dispatchEnabled: false, channelId: null, lastDispatchMessageIds: [] }, { merge: true });

    return NextResponse.json({ status: "disabled", feature: normalized, guildId });
  } catch (error) {
    console.error("/api/bot/disable-feature error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Allow simple GET for testing via ?feature=...&guildId=...
  return POST(request);
}
