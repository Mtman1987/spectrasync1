import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession, getAdminInfo } from '@/app/actions';
import RaidTrainClient from './RaidTrainClient';
import { AppLayout } from '@/components/layout/app-layout';

export default async function RaidTrainPageWrapper() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);
  const guildId = adminData?.selectedGuild ?? null;
  const adminGuilds = adminData?.guilds ?? [];

  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Raid Train...</div>}>
       <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={guildId} notifications={[]}>
            <RaidTrainClient 
                guildId={guildId}
            />
       </AppLayout>
    </Suspense>
  );
}
