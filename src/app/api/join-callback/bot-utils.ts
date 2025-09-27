'use server';

// src/app/api/join-callback/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { saveUserInfoByDiscordId } from "@/app/actions";
import { getRuntimeValue } from "@/lib/runtime-config";
import { isValidUrl } from "@/lib/sanitize";

const DEFAULT_BASE_URL = "https://spacemtn--cosmic-raid-app.us-central1.hosted.app";

async function resolveBaseUrl(request: NextRequest) {
    try {
        const runtime = await getRuntimeValue<string>("NEXT_PUBLIC_BASE_URL");
        if (runtime) return runtime;
    } catch (e) {
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
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    const baseUrl = await resolveBaseUrl(request);

    if (!code) {
        return NextResponse.redirect(new URL('/join?error=Missing authorization code', baseUrl));
    }

    let action: string | null = null;
    let guildIdFromState: string | null = null;

    if (state) {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        action = decodedState.action;
        guildIdFromState = decodedState.guildId;
    }

    if (!action || !guildIdFromState) {
         return NextResponse.redirect(new URL('/join?error=Invalid or missing action parameter', baseUrl));
    }

    try {
    const redirectUri = new URL('/api/join-callback', baseUrl).toString();

        const clientId = await getRuntimeValue<string>("NEXT_PUBLIC_DISCORD_CLIENT_ID", process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID);
        const clientSecret = await getRuntimeValue<string>("DISCORD_CLIENT_SECRET", process.env.DISCORD_CLIENT_SECRET);
        if (!clientId || !clientSecret) throw new Error("Server is missing Discord client credentials");

        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
            }).toString(),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            throw new Error(`Discord token exchange failed: ${tokenData.error_description || 'Unknown error'}`);
        }
        
        const accessToken = tokenData.access_token;
        
        // Validate Discord API endpoints to prevent SSRF
        const guildsUrl = 'https://discord.com/api/users/@me/guilds';
        const userUrl = 'https://discord.com/api/users/@me';
        
        if (!isValidUrl(guildsUrl) || !isValidUrl(userUrl)) {
            throw new Error('Invalid Discord API URLs');
        }
        
        const [guildsResponse, userResponse] = await Promise.all([
            fetch(guildsUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }),
            fetch(userUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
        ]);

        if (!guildsResponse.ok || !userResponse.ok) {
            throw new Error("Failed to fetch user's guilds or identity from Discord.");
        }
        
        const [guildsData, userData] = await Promise.all([guildsResponse.json(), userResponse.json()]);
        
        const discordId = userData.id;
        if (!discordId) {
            throw new Error("Could not resolve user's Discord ID.");
        }

        if (!guildsData.some((g: any) => g.id === guildIdFromState)) {
            return NextResponse.redirect(new URL(`/join?action=${action}&error=Could not determine a community. Please join the Discord server first.`, baseUrl));
        }

        // Save basic user info
        await saveUserInfoByDiscordId(guildIdFromState, discordId, {
            discordInfo: {
                id: userData.id,
                username: userData.username,
                avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null,
            }
        });
        
        const redirectUrl = new URL('/join', baseUrl);
        redirectUrl.searchParams.set('action', action);
        redirectUrl.searchParams.set('guildId', guildIdFromState);
        redirectUrl.searchParams.set('discordId', discordId);
        return NextResponse.redirect(redirectUrl);

    } catch (e) {
        console.error("Join callback error:", e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        const errorRedirectUrl = new URL(`/join?action=${action}`, baseUrl);
        errorRedirectUrl.searchParams.set('error', errorMessage);
        return NextResponse.redirect(errorRedirectUrl);
    }
}
