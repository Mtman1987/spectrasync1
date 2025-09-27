'use server';
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getRuntimeValue } from "./runtime-config";

const STATE_VERSION = "v1";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_SECRET = "cosmic-raid-discord-state-secret-2024";

async function getStateSecret(): Promise<string> {
    try {
        const runtimeSecret = await getRuntimeValue<string>("DISCORD_STATE_SECRET", process.env.DISCORD_STATE_SECRET);
        if (runtimeSecret) {
            return runtimeSecret;
        }
    } catch (error) {
        console.warn("Falling back to environment Discord state secret:", error);
    }

    if (process.env.DISCORD_STATE_SECRET) {
        return process.env.DISCORD_STATE_SECRET;
    }

    if (process.env.SESSION_SECRET) {
        return process.env.SESSION_SECRET;
    }

    return DEFAULT_SECRET;
}

export async function generateDiscordState(): Promise<string> {
    const secret = await getStateSecret();
    const timestamp = Date.now().toString(36);
    const nonce = randomBytes(16).toString("hex");
    const payload = `${timestamp}.${nonce}`;
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    return `${STATE_VERSION}.${payload}.${signature}`;
}

function safeCompare(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(actual, "hex");

    if (expectedBuffer.length !== actualBuffer.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function validateDiscordState(
    receivedState: string | null,
    storedState?: string | null,
): Promise<boolean> {
    if (!receivedState) {
        return false;
    }

    // Preserve legacy cookie-based flow if available
    if (storedState && storedState === receivedState) {
        return true;
    }

    const parts = receivedState.split(".");
    if (parts.length !== 4) {
        return false;
    }

    const [version, tsPart, nonce, signature] = parts;
    if (version !== STATE_VERSION) {
        return false;
    }

    let timestamp: number;
    try {
        timestamp = parseInt(tsPart, 36);
    } catch (error) {
        console.error("Failed to parse Discord state timestamp", error);
        return false;
    }

    if (Number.isNaN(timestamp)) {
        return false;
    }

    if (Date.now() - timestamp > STATE_TTL_MS) {
        return false;
    }

    if (!nonce || !signature) {
        return false;
    }

    let expectedSignature: string;
    try {
        const secret = await getStateSecret();
        const payload = `${tsPart}.${nonce}`;
        expectedSignature = createHmac("sha256", secret).update(payload).digest("hex");
    } catch (error) {
        console.error("Unable to resolve Discord state secret", error);
        return false;
    }

    try {
        return safeCompare(expectedSignature, signature);
    } catch (error) {
        console.error("Error validating Discord state signature", error);
        return false;
    }
}
