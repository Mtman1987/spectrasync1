'use server';
import { redirect } from 'next/navigation';
import { getSession, getAdminInfo, getLiveCommunityPoolUsers } from '@/app/actions';
import { CommunityPoolClientPage } from '@/app/community-pool/community-pool-client-page';
import { AppLayout } from '@/components/layout/app-layout';

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function CommunityPoolPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);
  const guildId = adminData?.selectedGuild ?? null;
  const adminGuilds = adminData?.discordUserGuilds ?? [];

  if (!guildId) {
    return (
      <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={guildId} notifications={[]}>
        <div className="text-center py-8 text-muted-foreground">
          Please select a community in your settings to view the community pool.
        </div>
      </AppLayout>
    );
  }

  const initialUsers = await getLiveCommunityPoolUsers(guildId);
  const isEmbedded = Object.prototype.hasOwnProperty.call(searchParams, 'frame_id');

  const pageContent = (
    <CommunityPoolClientPage
      initialUsers={initialUsers}
      spotlightTwitchId={null}
      isLoading={false}
      guildId={guildId}
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
