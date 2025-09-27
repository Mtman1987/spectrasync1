
'use client';

import { AppLayout } from "@/components/layout/app-layout";
import { Sparkles } from "lucide-react";
import { UserContentGenerator } from "@/app/community-spotlight/user-content-generator";
import ContentHistory from "./content-history";
import { redirect } from 'next/navigation';
import { getSession, getAdminInfo, getSelectedGuildId } from "@/app/actions";
import {
  getCalendarEvents,
  getTodaysAnnouncer,
} from '@/app/calendar/actions';
import {
  getRaidTrainEmergencies,
  getRaidTrainNoShows,
} from '@/app/raid-train/actions';
import { format } from 'date-fns';
import { useState, useEffect } from "react";

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

export default function CommunitySpotlightPage() {
  const [adminData, setAdminData] = useState<any>(null);
  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);
  const [adminGuilds, setAdminGuilds] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const session = await getSession();
      if (!session.isLoggedIn || !session.adminId) {
        redirect('/');
        return;
      }
      const { value: adminInfo } = await getAdminInfo(session.adminId);
      const guildId = await getSelectedGuildId(session.adminId);
      const guilds = adminInfo?.discordUserGuilds ?? [];
      const notifs = await getNotifications(guildId);
      
      setAdminData(adminInfo);
      setSelectedGuild(guildId);
      setAdminGuilds(guilds);
      setNotifications(notifs);
      setLoading(false);
    }
    fetchData();
  }, []);

  if(loading) {
    return <div className="flex h-screen w-full items-center justify-center">Loading Community Spotlight...</div>
  }

  return (
    <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={selectedGuild} notifications={notifications}>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Community Spotlight
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            A tool to help users generate polished posts to showcase their content.
          </p>
        </div>
        <UserContentGenerator />
        <ContentHistory />
      </div>
    </AppLayout>
  );
}
