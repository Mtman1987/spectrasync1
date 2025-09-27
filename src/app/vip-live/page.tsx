'use server';

import { redirect } from 'next/navigation';
import { getSession, getAdminInfo, getLiveVipUsers, addVip, removeVip, createAndAddVip, updateVip } from '@/app/actions';
import { getAllVips, sendVipLiveNotification } from './actions';
import { AppLayout } from '@/components/layout/app-layout';
import { VipLiveClientPage } from './vip-live-client-page';
import { getRuntimeValue } from '@/lib/runtime-config';

export default async function VipLivePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);
  const guildId = adminData?.selectedGuild ?? null;
  const adminGuilds = adminData?.guilds ?? [];
  const isEmbedded = searchParams ? Object.prototype.hasOwnProperty.call(searchParams, 'frame_id') : false;

  const baseUrl = await getRuntimeValue<string>('NEXT_PUBLIC_BASE_URL');
  const parentDomain = baseUrl ? new URL(baseUrl).hostname : 'localhost';

  if (!guildId) {
    const NoGuildContent = () => (
        <div className="text-center py-8 text-muted-foreground">
          Please select a community in your settings to manage VIPs.
        </div>
    );
    if (isEmbedded) return <div className="p-4 bg-background"><NoGuildContent/></div>;
    return (
      <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={guildId} notifications={[]}>
        <NoGuildContent/>
      </AppLayout>
    );
  }

  const [liveVips, allVips] = await Promise.all([
    getLiveVipUsers(guildId),
    getAllVips(guildId),
  ]);

  const pageContent = (
    <VipLiveClientPage
      liveVips={liveVips}
      allVips={allVips}
      isLoading={false}
      parentDomain={parentDomain}
      guildId={guildId}
      serverActions={{ sendVipLiveNotification, addVip, removeVip, createAndAddVip, updateVip }}
    />
  );

  if (isEmbedded) {
    return <div className="p-4 bg-background">{pageContent}</div>;
  }

  return (
    <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={guildId} notifications={[]}>
      {pageContent}
    </AppLayout>
  );
}
