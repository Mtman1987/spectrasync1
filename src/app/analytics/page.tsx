'use server';

import { AppLayout } from "@/components/layout/app-layout";
import { redirect } from 'next/navigation';
import { getSession, getAdminInfo } from "@/app/actions";
import { AnalyticsCharts } from "./analytics-charts";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);
  const selectedGuild = adminData?.selectedGuild ?? null;
  const adminGuilds = adminData?.guilds ?? [];

  return (
    <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={selectedGuild} notifications={[]}>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Community Analytics
          </h1>
          <p className="text-muted-foreground">
            Track engagement, growth, and points distribution in your community.
          </p>
        </div>
        <AnalyticsCharts />
      </div>
    </AppLayout>
  );
}
