'use client';

import type { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';
import { ScrollArea } from '../ui/scroll-area';
import { CommunityProvider } from '@/context/community-context';

// Define types for the props
interface AdminProfile {
  discordInfo: {
    id: string;
    username: string;
    avatar: string | null;
  };
  twitchInfo?: any;
}

interface AdminGuild {
  id: string;
  name: string;
  icon: string | null;
}

interface AppLayoutProps {
  children: ReactNode;
  adminProfile: AdminProfile | null;
  adminGuilds: AdminGuild[];
  selectedGuild: string | null;
  notifications: any[];
}

export function AppLayout({
  children,
  adminProfile,
  adminGuilds,
  selectedGuild,
  notifications,
}: AppLayoutProps) {
  return (
    <CommunityProvider
      initialAdminId={adminProfile?.discordInfo?.id ?? null}
      initialSelectedGuild={selectedGuild}
      initialAdminGuilds={adminGuilds}
    >
      <SidebarProvider>
        <div className="flex min-h-svh w-full bg-background">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <AppHeader initialNotifications={notifications} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <main className="p-4 sm:p-6 lg:p-8">{children}</main>
              </ScrollArea>
            </div>
          </div>
        </div>
      </SidebarProvider>
    </CommunityProvider>
  );
}
