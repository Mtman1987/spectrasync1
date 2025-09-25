// src/app/api/auth/discord/callback/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { saveAdminInfo } from "@/app/actions";
import { getRuntimeValue } from "@/lib/runtime-config";
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getSessionOptions, type SessionData } from '@/lib/session';

const DEFAULT_BASE_URL = "https://spacemtn--cosmic-raid-app.us-central1.hosted.app";

async function resolveBaseUrl(request: NextRequest) {
    try {
        const runtime = await getRuntimeValue<string>("NEXT_PUBLIC_BASE_URL");
        if (runtime) return runtime;
    } catch (e) {
        console.error("Error fetching runtime base URL:", e);
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
    const storedState = request.cookies.get('discord_oauth_state')?.value;

    const baseUrl = await resolveBaseUrl(request);

    if (!code) {
        return NextResponse.redirect(new URL('/?error=Missing authorization code', baseUrl));
    }

    if (!state || !storedState || state !== storedState) {
        return NextResponse.redirect(new URL('/?error=Invalid state parameter. Please try again.', baseUrl));
    }

    try {
        const redirectUri =
            process.env.DISCORD_REDIRECT_URI ||
            new URL('/api/auth/discord/callback', baseUrl).toString();

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

        const [guildsResponse, userResponse] = await Promise.all([
            fetch('https://discord.com/api/users/@me/guilds', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }),
            fetch('https://discord.com/api/users/@me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
        ]);

        if (!guildsResponse.ok || !userResponse.ok) {
            throw new Error("Failed to fetch user's guilds or identity from Discord.");
        }
        
        const guildsData = await guildsResponse.json();
        const userData = await userResponse.json();
        
        const adminDiscordId = userData.id;
        if (!adminDiscordId) {
            throw new Error("CRITICAL: Could not resolve admin's Discord ID from Discord API.");
        }

        const adminGuilds = guildsData.filter((guild: any) => 
            (BigInt(guild.permissions) & BigInt(0x8)) === BigInt(0x8) // ADMINISTRATOR permission
        );

        const adminData = {
            discordInfo: {
                id: userData.id,
                username: userData.username,
                avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null,
            },
            discordUserGuilds: adminGuilds.map((g: any) => ({ id: g.id, name: g.name, icon: g.icon })),
        };
        
        // Save the admin info to the global 'admins' collection
        await saveAdminInfo(adminDiscordId, adminData);

        // Create a server-side session
        const sessionOptions = await getSessionOptions();
        const session = await getIronSession<SessionData>(cookies(), sessionOptions);
        session.adminId = adminDiscordId;
        session.isLoggedIn = true;
        await session.save();
        
        // Redirect directly to the dashboard
        return NextResponse.redirect(new URL('/dashboard', baseUrl));

    } catch (e) {
        console.error("Discord callback error:", e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    const errorRedirectUrl = new URL('/', baseUrl);
        errorRedirectUrl.searchParams.set('error', errorMessage);
        return NextResponse.redirect(errorRedirectUrl);
    }
}