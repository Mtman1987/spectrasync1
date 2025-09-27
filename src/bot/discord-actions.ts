'use server';
const DISCORD_API_BASE = process.env.DISCORD_API_BASE_URL ?? 'https://discord.com/api/v10';

type DiscordWebhookMessage = {
  id: string;
};

type WebhookPayload = {
  content?: string;
  embeds?: Array<Record<string, unknown>>;
  components?: Array<Record<string, unknown>>;
};

function ensureWebhookUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new Error(`Invalid Discord webhook URL: ${url}`);
  }
}

async function callDiscordWebhook(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const webhookUrl = ensureWebhookUrl(url);
  const response = await fetch(webhookUrl.toString(), init);
  return response;
}

export async function postToWebhook(
  webhookUrl: string,
  payload: WebhookPayload,
): Promise<DiscordWebhookMessage | null> {
  const response = await callDiscordWebhook(`${webhookUrl}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook POST failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as DiscordWebhookMessage;
  return json;
}

export async function editWebhookMessage(
  webhookUrl: string,
  messageId: string,
  payload: WebhookPayload,
): Promise<void> {
  const response = await callDiscordWebhook(`${webhookUrl}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook PATCH failed (${response.status}): ${body}`);
  }
}

export async function deleteWebhookMessage(
  webhookUrl: string,
  messageId: string,
): Promise<void> {
  const response = await callDiscordWebhook(`${webhookUrl}/messages/${messageId}`, {
    method: 'DELETE',
  });

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook DELETE failed (${response.status}): ${body}`);
  }
}
