import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, getAdminInfo } from "@/app/actions";
import { SettingsClientPage } from "./settings-client";
import { AppLayout } from "@/components/layout/app-layout";

export default async function SettingsPage() {
    const session = await getSession();

    if (!session.isLoggedIn || !session.adminId) {
        redirect('/');
    }

    const { value: adminData } = await getAdminInfo(session.adminId);
    const selectedGuild = adminData?.selectedGuild ?? null;
    const adminGuilds = adminData?.guilds ?? [];

    const pageContent = (
        <SettingsClientPage 
            guildId={selectedGuild} 
            adminId={session.adminId} 
            initialCommunityInfo={adminData?.discordUserGuilds?.find((g: any) => g.id === selectedGuild) || null} 
        />
    );

    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Settings...</div>}>
            <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={selectedGuild}>
                {pageContent}
            </AppLayout>
        </Suspense>
    );
}