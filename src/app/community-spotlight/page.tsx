'use server';

import { AppLayout } from "@/components/layout/app-layout";
import { Sparkles } from "lucide-react";
import { UserContentGenerator } from "@/app/community-spotlight/user-content-generator";
import ContentHistory from "./content-history";
import { redirect } from 'next/navigation';
import { getSession, getAdminInfo, getSelectedGuildId } from "@/app/actions";

// This page can now be a Server Component because the interactive parts
// are encapsulated in their own client components.

export default async function CommunitySpotlightPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
    return;
  }
  
  const { value: adminData } = await getAdminInfo(session.adminId);
  const selectedGuild = await getSelectedGuildId(session.adminId);
  const adminGuilds = adminData?.discordUserGuilds ?? [];

  // Notifications can be fetched here on the server if needed for this page
  const notifications: any[] = []; 

  return (
    <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={selectedGuild} notifications={notifications}>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Community Spotlight
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            A tool to help users generate polished posts to showcase their content.
          </p>
        </div>
        <UserContentGenerator />
        <ContentHistory />
      </div>
    </AppLayout>
  );
}
