import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getAdminInfo, getLiveRaidPiles, getLeaderboard } from '@/app/actions';
import { RaidPileClientPage } from "@/app/raid-pile/raid-pile-client-page";
import { AppLayout } from "@/components/layout/app-layout";

async function RaidPilePageContent() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);
  const guildId = adminData?.selectedGuild;

  if (!guildId) {
    return (
      <AppLayout>
        <div className="text-center py-8 text-muted-foreground">
          Please select a community in your settings to view the raid pile.
        </div>
      </AppLayout>
    );
  }

  const [initialRaidPiles, leaderboardData] = await Promise.all([
    getLiveRaidPiles(guildId),
    getLeaderboard(guildId),
  ]);

  return (
    <AppLayout>
      <RaidPileClientPage
        guildId={guildId}
        initialRaidPiles={initialRaidPiles}
        leaderboardData={leaderboardData}
      />
    </AppLayout>
  );
}

function RaidPilePageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Raid Pile...</div>}>
      <RaidPilePageContent />
    </Suspense>
  );
}

export default RaidPilePageWrapper;
    
    
