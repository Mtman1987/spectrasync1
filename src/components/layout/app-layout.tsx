'use server';
"use client";

import type { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';
import { ScrollArea } from '../ui/scroll-area';

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
    <SidebarProvider>
      <div className="flex min-h-svh w-full bg-background">
        <AppSidebar adminProfile={adminProfile} adminGuilds={adminGuilds} selectedGuild={selectedGuild} />
        <div className="flex flex-1 flex-col">
          <AppHeader notifications={notifications} selectedGuild={selectedGuild} adminGuilds={adminGuilds} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <main className="p-4 sm:p-6 lg:p-8">{children}</main>
            </ScrollArea>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
