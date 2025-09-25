
"use client";

import { Suspense } from "react";
import { SettingsClientPage } from "./settings-client";
import { redirect } from "next/navigation";
import { getAdminInfo } from "@/app/actions";

async function SettingsPageContent() {
    const { getSession } = await import('@/lib/session');
    const session = await getSession();

    if (!session.isLoggedIn || !session.adminId) {
        redirect('/');
    }

    const { value: adminData } = await getAdminInfo(session.adminId);
    const selectedGuild = adminData?.selectedGuild;

    if (!selectedGuild) {
        // Or render a message asking them to select a guild
        redirect('/dashboard');
    }

    const initialCommunityInfo = adminData?.discordUserGuilds?.find((g: any) => g.id === selectedGuild) || null;

    return <SettingsClientPage guildId={selectedGuild} adminId={session.adminId} initialCommunityInfo={initialCommunityInfo} />
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Settings...</div>}>
           <SettingsPageContent />
        </Suspense>
    )
}
