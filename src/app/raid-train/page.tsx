import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession, getAdminInfo } from '@/app/actions';
import RaidTrainClient from './RaidTrainClient';

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
      <RaidTrainClient 
        guildId={guildId}
        adminProfile={adminData}
        adminGuilds={adminGuilds}
        selectedGuild={guildId}
      />
    </Suspense>
  );
}