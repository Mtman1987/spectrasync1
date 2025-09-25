import { redirect } from 'next/navigation';
import { getSession, getAdminInfo, getLiveVipUsers } from '@/app/actions';
import { getAllVips } from './actions';
import { VipLiveClientPage } from '@/app/vip-live/vip-live-client-page';
import { AppLayout } from '@/components/layout/app-layout';

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function VipLivePage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);
  const guildId = adminData?.selectedGuild ?? null;
  const adminGuilds = adminData?.guilds ?? [];

  if (!guildId) {
    return (
      <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={guildId}>
        <div className="text-center py-8 text-muted-foreground">
          Please select a community in your settings to manage VIPs.
        </div>
      </AppLayout>
    );
  }

  const [liveVips, allVips] = await Promise.all([
    getLiveVipUsers(guildId),
    getAllVips(guildId),
  ]);

  const isEmbedded = Object.prototype.hasOwnProperty.call(searchParams, 'frame_id');

  const pageContent = (
    <VipLiveClientPage
      liveVips={liveVips}
      allVips={allVips}
      isLoading={false}
      parentDomain=""
      guildId={guildId}
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