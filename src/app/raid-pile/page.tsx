import { redirect } from 'next/navigation';
import { getSession, getAdminInfo, getLiveRaidPiles } from '@/app/actions';
import { getLeaderboard } from '@/app/leaderboard/actions';
import { RaidPileClientPage } from '@/app/raid-pile/raid-pile-client-page';
import { AppLayout } from '@/components/layout/app-layout';

type PageProps = {
  searchParams: Record<string, string | string[] | undefined> | undefined;
};

export default async function RaidPilePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);
  const guildId = adminData?.selectedGuild ?? null;
  const adminGuilds = adminData?.guilds ?? [];
  const isEmbedded = searchParams ? Object.prototype.hasOwnProperty.call(searchParams, 'frame_id') : false;

  if (!guildId) {
    const content = (
      <div className="text-center py-8 text-muted-foreground">
        Please select a community in your settings to view the raid pile.
      </div>
    );

    if (isEmbedded) {
      return <div className="p-4 bg-background">{content}</div>;
    }

    return (
        <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={guildId}>
            {content}
        </AppLayout>
    );
  }

  const [initialRaidPiles, leaderboardData] = await Promise.all([
    getLiveRaidPiles(guildId),
    getLeaderboard(guildId),
  ]);

  const pageContent = (
    <RaidPileClientPage
      guildId={guildId}
      initialRaidPiles={initialRaidPiles}
      leaderboardData={leaderboardData}
    />
  );

  if (isEmbedded) {
    return <div className="p-4 bg-background">{pageContent}</div>;
  }

  return (
    <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={guildId}>
        {pageContent}
    </AppLayout>
  );
}