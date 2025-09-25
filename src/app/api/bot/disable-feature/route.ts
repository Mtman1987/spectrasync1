import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { deleteDiscordMessages, validateBotSecret } from "@/lib/bot-utils";

export const dynamic = 'force-dynamic';

// Map external feature identifiers to Firestore settings document IDs
const FEATURE_TO_CONFIG_ID: Record<string, string> = {
  "vip-live": "vipLiveConfig",
  "community-pool": "communityPoolConfig",
  "raid-train": "raidTrainConfig",
  "raid-pile": "raidPileConfig",
};

export async function POST(request: NextRequest) {
  try {
    const secretStatus = await validateBotSecret(request);
    if (!secretStatus.valid) {
      return NextResponse.json({ error: "Unauthorized", reason: secretStatus.reason }, { status: 401 });
    }

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
