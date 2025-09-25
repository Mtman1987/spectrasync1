
"use client"

import { getLiveCommunityPoolUsers } from "@/app/actions";
import { CommunityPoolClientPage } from "@/app/community-pool/community-pool-client-page";
import { AppLayout } from "@/components/layout/app-layout";
import { useEffect, useState, Suspense } from "react";
import type { LiveUser } from "@/app/raid-pile/types";
import { useSearchParams } from "next/navigation";


function CommunityPoolPageContent({ guildId }: { guildId: string | null }) {
    const [initialUsers, setInitialUsers] = useState<LiveUser[]>([]);
    const [spotlightTwitchId, setSpotlightTwitchId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const searchParams = useSearchParams();
    const isEmbedded = searchParams.has("frame_id");

    useEffect(() => {
        async function fetchData() {
            if (!guildId) {
                console.log("No guild ID found, skipping data fetch.");
                setIsLoading(false);
                return;
            };
            setIsLoading(true);

            const users = await getLiveCommunityPoolUsers(guildId);
            setInitialUsers(users);

            // In a future step, you might fetch the spotlight user ID here
            // For now, we just fetch the users.

            setIsLoading(false);
        }

        fetchData();
    }, [guildId]);
    
    const pageContent = (
         <CommunityPoolClientPage
            initialUsers={initialUsers}
            spotlightTwitchId={spotlightTwitchId}
            isLoading={isLoading}
            guildId={guildId || ""}
          />
    );

    if (isEmbedded) {
        return <div className="p-4 bg-background">{pageContent}</div>;
    }

    return (
        <AppLayout>
           {pageContent}
        </AppLayout>
    );
}


async function CommunityPoolPageWrapper() {
  const { getSession } = await import('@/lib/session');
  const { getAdminInfo } = await import('@/app/actions');
  const { redirect } = await import('next/navigation');

  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);
  const guildId = adminData?.selectedGuild ?? null;

  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Community Pool...</div>}>
      <CommunityPoolPageContent guildId={guildId} />
    </Suspense>
  );
}

export default CommunityPoolPageWrapper;
