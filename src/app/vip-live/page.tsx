
"use client"

import { getLiveVipUsers, getAdminInfo } from "@/app/actions";
import { VipLiveClientPage } from "@/app/vip-live/vip-live-client-page";
import { AppLayout } from "@/components/layout/app-layout";
import { useEffect, useState, Suspense, useCallback } from "react";
import type { LiveUser } from "@/app/raid-pile/types";
import { useSearchParams } from "next/navigation";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { getClientApp } from "@/lib/firebase";


function VipLivePageContent({ guildId }: { guildId: string | null }) {
    const [liveVips, setLiveVips] = useState<LiveUser[]>([]);
    const [allVips, setAllVips] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const searchParams = useSearchParams();
    const isEmbedded = searchParams.has("frame_id");

    const fetchData = useCallback(async () => {
        if (!guildId) {
            setIsLoading(false);
            return;
        };
        setIsLoading(true);

        const db = getFirestore(getClientApp());
        const usersRef = collection(db, `communities/${guildId}/users`);
        const q = query(usersRef, where("isVip", "==", true));
        const vipSnapshot = await getDocs(q);
        const vipDocs = vipSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllVips(vipDocs);
        
        const liveVipUsers = await getLiveVipUsers(guildId);
        setLiveVips(liveVipUsers);

        setIsLoading(false);
    }, [guildId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const pageContent = (
         <VipLiveClientPage
            liveVips={liveVips}
            allVips={allVips}
            isLoading={isLoading}
            guildId={guildId || ""}
            onVipChanged={fetchData}
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


async function VipLivePageWrapper() {
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
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading VIPs...</div>}>
      <VipLivePageContent guildId={guildId} />
    </Suspense>
  );
}

export default VipLivePageWrapper;
