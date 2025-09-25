// src/app/api/auth/discord/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getRuntimeValue } from "@/lib/runtime-config";

const DEFAULT_BASE_URL = "https://spacemtn--cosmic-raid-app.us-central1.hosted.app";

async function resolveBaseUrl(request: NextRequest) {
    // Prefer runtime config stored in Firestore (set by admin API)
    try {
        const runtime = await getRuntimeValue<string>("NEXT_PUBLIC_BASE_URL");
        if (runtime) return runtime;
    } catch (e) {
        // ignore runtime errors and fall back
        console.error("Error reading runtime config for base URL:", e);
    }

    if (process.env.NEXT_PUBLIC_BASE_URL) {
        return process.env.NEXT_PUBLIC_BASE_URL;
    }

    if (process.env.NODE_ENV === "development") {
        return request.nextUrl.origin;
    }

    return DEFAULT_BASE_URL;
}

export async function GET(request: NextRequest) {
    // Generate a random state for CSRF protection
    const state = randomBytes(16).toString('hex');

    const baseUrl = await resolveBaseUrl(request);
    const redirectUri =
        process.env.DISCORD_REDIRECT_URI ||
        new URL('/api/auth/discord/callback', baseUrl).toString();

    const discordAuthUrl = new URL("https://discord.com/oauth2/authorize");
    const clientId = await getRuntimeValue<string>("DISCORD_CLIENT_ID", process.env.DISCORD_CLIENT_ID) || 
                     await getRuntimeValue<string>("NEXT_PUBLIC_DISCORD_CLIENT_ID", process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID);
    if (!clientId) throw new Error("Server is missing Discord Client ID");

    discordAuthUrl.searchParams.set("client_id", clientId);
    discordAuthUrl.searchParams.set("redirect_uri", redirectUri);
    discordAuthUrl.searchParams.set("response_type", "code");
    discordAuthUrl.searchParams.set("scope", "identify guilds");
    discordAuthUrl.searchParams.set("state", state);

    // Store the state in a cookie to verify it on callback
    const response = NextResponse.redirect(discordAuthUrl.toString());
    response.cookies.set('discord_oauth_state', state, { path: '/', httpOnly: true, maxAge: 300 }); // Expires in 5 minutes

    return response;
}
