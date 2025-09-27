'use server';

import { redirect } from 'next/navigation';
import { getSession, getAdminInfo, getSelectedGuildId } from '@/app/actions';
import { AdminAccountCard } from '@/components/admin-account-card';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { History, Search } from 'lucide-react';
import { getAttendanceRecord } from './actions';

export default async function DashboardPage({ searchParams }: { searchParams: { userId?: string } }) {
  const session = await getSession();
  
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminInfo } = await getAdminInfo(session.adminId);
  const selectedGuildId = await getSelectedGuildId(session.adminId);
  const adminGuilds = adminInfo?.discordUserGuilds ?? [];

  let searchResult: string | null = null;
  if (selectedGuildId && searchParams.userId) {
    const result = await getAttendanceRecord(selectedGuildId, searchParams.userId);
    if (result.success) {
      searchResult = `${result.userName} has been in ${result.count} community raids.`;
    } else {
      searchResult = result.error || "An unknown error occurred.";
    }
  }

  if (!adminInfo) {
    return (
       <AppLayout adminProfile={adminInfo} adminGuilds={adminGuilds} selectedGuild={selectedGuildId} notifications={[]}>
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Loading Profile...</h2>
                <p className="text-muted-foreground">Setting up your admin profile</p>
                </div>
            </div>
       </AppLayout>
    );
  }

  return (
    <AppLayout adminProfile={adminInfo} adminGuilds={adminGuilds} selectedGuild={selectedGuildId} notifications={[]}>
        <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome to your Cosmic Raid control center</p>
        </div>

        <AdminAccountCard
            adminId={session.adminId}
            discordInfo={adminInfo.discordInfo}
            twitchInfo={adminInfo.twitchInfo}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline">
                    <History />
                    Raid Attendance
                </CardTitle>
                <CardDescription>
                    Check a user&apos;s raid participation history by their Discord ID or Twitch ID.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="flex w-full items-center space-x-2">
                    <Input
                        type="text"
                        name="userId"
                        placeholder="Enter User ID..."
                        defaultValue={searchParams.userId}
                    />
                    <Button type="submit" size="icon">
                        <Search className="h-4 w-4" />
                        <span className="sr-only">Search</span>
                    </Button>
                </form>
                
                {searchResult && (
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                        <p className="font-semibold text-muted-foreground">{searchResult}</p>
                    </div>
                )}
              </CardContent>
            </Card>
            
            <div className="p-6 border rounded-lg">
            <h3 className="font-semibold mb-2">Community</h3>
            <div className="space-y-2">
                <a href="/community-pool" className="block text-sm text-blue-600 hover:underline">
                Community Pool
                </a>
                <a href="/leaderboard" className="block text-sm text-blue-600 hover:underline">
                Leaderboard
                </a>
                <a href="/analytics" className="block text-sm text-blue-600 hover:underline">
                Analytics
                </a>
            </div>
            </div>

            <div className="p-6 border rounded-lg">
            <h3 className="font-semibold mb-2">Settings</h3>
            <div className="space-y-2">
                <a href="/settings" className="block text-sm text-blue-600 hover:underline">
                App Settings
                </a>
                <a href="/team-chat" className="block text-sm text-blue-600 hover:underline">
                Team Chat
                </a>
            </div>
            </div>
        </div>
        </div>
    </AppLayout>
  );
}
