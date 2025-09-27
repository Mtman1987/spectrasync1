'use server';

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, getAdminInfo, getSelectedGuildId } from "@/app/actions";
import { SettingsClientPage } from "./settings-client";
import { AppLayout } from "@/components/layout/app-layout";
import {
  getCalendarEvents,
  getTodaysAnnouncer,
} from '@/app/calendar/actions';
import {
  getRaidTrainEmergencies,
  getRaidTrainNoShows,
} from '@/app/raid-train/actions';
import { format } from 'date-fns';

type Notification = {
  title: string;
  description: string;
  href: string;
};

async function getNotifications(guildId: string | null): Promise<Notification[]> {
  if (!guildId) return [];

  try {
    const [announcer, emergencies, noShows, events] = await Promise.all([
      getTodaysAnnouncer(guildId),
      getRaidTrainEmergencies(guildId),
      getRaidTrainNoShows(guildId),
      getCalendarEvents(guildId),
    ]);

    const allNotifications: Notification[] = [];

    if (announcer) {
      allNotifications.push({
        title: `Captain's Log Duty: @${announcer.userName}`,
        description: `Today's announcements are by ${announcer.userName}.`,
        href: `/calendar`,
      });
    } else {
      allNotifications.push({
        title: "Captain's Log spot is open for today!",
        description: 'Click here to go to the calendar and sign up.',
        href: `/calendar`,
      });
    }

    emergencies.forEach((e) =>
      allNotifications.push({
        title: 'Raid Train Emergency!',
        description: `A spot opened up on ${e.date} at ${e.time}.`,
        href: `/raid-train`,
      })
    );

    noShows.forEach((ns) =>
      allNotifications.push({
        title: 'Raid Train No-Show!',
        description: `${ns.name} missed their ${ns.time} slot.`,
        href: `/raid-train`,
      })
    );

    events
      .filter((event) => new Date(event.date) >= new Date())
      .slice(0, 3) // Limit to 3 upcoming events
      .forEach((event) =>
        allNotifications.push({
          title: `Upcoming: ${event.name}`,
          description: `${format(new Date(event.date), 'MMM d')} at ${
            event.time
          }`,
          href: `/calendar`,
        })
      );

    return allNotifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

export default async function SettingsPage() {
    const session = await getSession();

    if (!session.isLoggedIn || !session.adminId) {
        redirect('/');
    }

    const { value: adminData } = await getAdminInfo(session.adminId);
    const selectedGuild = await getSelectedGuildId(session.adminId);
    const adminGuilds = adminData?.discordUserGuilds ?? [];
    const notifications = await getNotifications(selectedGuild);

    const pageContent = (
        <SettingsClientPage 
            guildId={selectedGuild} 
            adminId={session.adminId} 
            initialCommunityInfo={adminData?.discordUserGuilds?.find((g: any) => g.id === selectedGuild) || null} 
        />
    );

    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Settings...</div>}>
            <AppLayout 
              adminProfile={adminData} 
              adminGuilds={adminGuilds} 
              selectedGuild={selectedGuild}
              notifications={notifications}
            >
                {pageContent}
            </AppLayout>
        </Suspense>
    );
}
