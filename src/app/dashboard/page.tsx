
import { redirect } from 'next/navigation';
import { getSession, getAdminInfo, getSelectedGuildId } from '@/app/actions';
import { AdminAccountCard } from '@/components/admin-account-card';
import { AppLayout } from '@/components/layout/app-layout';

export default async function DashboardPage() {
  const session = await getSession();
  
  // The middleware now handles the redirect, but we keep this as a secondary check.
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminInfo } = await getAdminInfo(session.adminId);
  const selectedGuildId = await getSelectedGuildId(session.adminId);
  const adminGuilds = adminInfo?.discordUserGuilds ?? [];

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
            <div className="p-6 border rounded-lg">
            <h3 className="font-semibold mb-2">Quick Actions</h3>
            <div className="space-y-2">
                <a href="/raid-pile" className="block text-sm text-blue-600 hover:underline">
                Manage Raid Pile
                </a>
                <a href="/raid-train" className="block text-sm text-blue-600 hover:underline">
                Raid Train Schedule
                </a>
                <a href="/vip-live" className="block text-sm text-blue-600 hover:underline">
                VIP Management
                </a>
            </div>
            </div>

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
