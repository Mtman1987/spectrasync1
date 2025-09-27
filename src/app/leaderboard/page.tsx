import { AppLayout } from "@/components/layout/app-layout";
import { redirect } from 'next/navigation';
import { getSession, getAdminInfo } from "@/app/actions";

export default async function LeaderboardPage() {
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
            Leaderboard
          </h1>
          <p className="text-muted-foreground">
            The community leaderboard is managed via the Discord bot. Use the `/leaderboard` command in your server.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
