import { type NextRequest } from "next/server";

const DISCORD_API_BASE = process.env.DISCORD_API_BASE_URL ?? "https://discord.com/api/v10";

const SECRET_PLACEHOLDERS = new Set([
  "your-super-secret-key-that-you-share-with-your-bot",
  "changeme",
  "placeholder",
]);

function shouldEnforceSecret(secretValue: string | undefined | null) {
  if (!secretValue) {
    return false;
  }

  const normalized = secretValue.trim().toLowerCase();
  return normalized.length > 0 && !SECRET_PLACEHOLDERS.has(normalized);
}

export function validateBotSecret(request: NextRequest) {
  const expectedSecret = process.env.BOT_SECRET_KEY;
  if (!shouldEnforceSecret(expectedSecret)) {
    // For local dev or unconfigured servers, we can be permissive.
    // In a real production environment, the secret should always be set.
    if (process.env.NODE_ENV === "production") {
      console.warn("BOT_SECRET_KEY is not set in a production environment. Requests will be unauthenticated.");
    }
    return { valid: true };
  }

  let providedSecret = request.headers.get("x-bot-secret") ?? request.headers.get("authorization");

  if (!providedSecret && request.method === "GET") {
    providedSecret = request.nextUrl.searchParams.get("secret");
  }

  if (!providedSecret) {
    return { valid: false, reason: "Missing secret" };
  }

  if (providedSecret.toLowerCase().startsWith("bearer ")) {
    providedSecret = providedSecret.slice(7).trim();
  }

  if (providedSecret === expectedSecret) {
    return { valid: true };
  }

  return { valid: false, reason: "Invalid secret" };
}

export async function deleteDiscordMessages(channelId: string, messageIds: string[]) {
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
      console.warn(`Failed to delete single Discord message ${messageIds[0]}: ${await response.text()}`);
    }
    return;
  }

  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/bulk-delete`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json", "User-Agent": userAgent },
    body: JSON.stringify({ messages: messageIds.slice(0, 100) }), // API limit is 100
  });

  if (!response.ok) console.warn(`Discord bulk delete failed (status ${response.status}): ${await response.text()}`);
}