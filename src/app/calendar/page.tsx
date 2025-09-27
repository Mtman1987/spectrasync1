'use server';
import React, { Suspense } from "react"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Users, Crown, Rocket, Loader2, Shield, Megaphone, UserPlus, AlertCircle } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { type CalendarEvent, type AnnouncementSignup, signUpForAnnouncement } from "@/app/calendar/actions"
import { AddEventForm } from "@/app/calendar/add-event-form"
import { Button } from "@/components/ui/button"
import { format, startOfDay, parse } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DayContent, DayContentProps } from "react-day-picker"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

const eventIcons = {
  Community: Users,
  VIP: Crown,
  Raid: Rocket,
  Admin: Shield,
};

import { CalendarClient } from "./calendar-client";

function CalendarPageContent({ 
    guildId, 
    adminDiscordId, 
    adminProfile, 
    adminGuilds, 
    selectedGuild, 
    initialEvents, 
    initialSignups,
    currentMonthString,
    isEmbedded
}: { 
    guildId: string | null, 
    adminDiscordId: string | null, 
    adminProfile: any, 
    adminGuilds: any[], 
    selectedGuild: string | null, 
    initialEvents: CalendarEvent[], 
    initialSignups: { [day: string]: AnnouncementSignup },
    currentMonthString: string,
    isEmbedded: boolean
}) {
  const userSignupsThisMonth = adminDiscordId ? Object.values(initialSignups).filter(s => s.userId === adminDiscordId).length : 0;
  const currentMonth = parse(currentMonthString, 'yyyy-MM', new Date());
  const pageContent = (
      <div className="flex flex-col gap-8">
      <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">
              Community Calendar
            </h1>
            <p className="text-muted-foreground">
              Schedule of community events and announcement roster.
            </p>
          </div>
      </div>

       {!guildId && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Community Not Found</AlertTitle>
                <AlertDescription>
                    Could not find a community ID. Please select a community from the sidebar or link one in settings.
                </AlertDescription>
            </Alert>
        )}

      {adminDiscordId && (
          <Alert variant={userSignupsThisMonth >= 5 ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Your Announcement Signups</AlertTitle>
              <AlertDescription>
                  You have claimed {userSignupsThisMonth} out of 5 available announcement spots for {format(currentMonth, 'MMMM')}.
              </AlertDescription>
          </Alert>
      )}

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
             <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-headline">
                      <Megaphone className="text-primary"/>
                      Captain&apos;s Log Roster
                  </CardTitle>
                  <CardDescription>
                      {adminDiscordId ? "Select an available day to sign up for announcement duties. Mods can claim up to 5 spots per month." : "Admin ID not configured."}
                  </CardDescription>
              </CardHeader>
            <CardContent className="p-0 flex justify-center">
                <CalendarClient 
                  guildId={guildId}
                  adminDiscordId={adminDiscordId}
                  initialSignups={initialSignups}
                  currentMonthString={currentMonthString}
                />
            </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-headline">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {initialEvents.length === 0 && (
              <p className="text-muted-foreground text-center">No upcoming events.</p>
            )}
            {initialEvents.map((event) => {
              const Icon = eventIcons[event.type as keyof typeof eventIcons] || Users;
              return (
                  <div key={event.id} className="flex items-start gap-4">
                    {Icon && <Icon className="h-5 w-5 text-primary mt-1" />}
                    <div>
                      <p className="font-semibold">{event.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.date).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          timeZone: "UTC",
                        })}{" "}
                        at {event.time}
                      </p>
                    </div>
                  </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (isEmbedded) {
    return <div className="p-4 bg-background">{pageContent}</div>;
  }

  return (
    <AppLayout adminProfile={adminProfile} adminGuilds={adminGuilds} selectedGuild={selectedGuild} notifications={[]}>
        {pageContent}
    </AppLayout>
  );
}

async function CalendarPageWrapper({ searchParams }: { searchParams: { month?: string, frame_id?: string } }) {
  const { getSession, getAdminInfo } = await import('@/app/actions');
  const { getCalendarEvents, getAnnouncementSignups } = await import('@/app/calendar/actions');
  const { redirect } = await import('next/navigation');
  const { format, parse } = await import('date-fns');

  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);
  const guildId = adminData?.selectedGuild ?? null;
  const adminGuilds = adminData?.guilds ?? [];

  const currentMonthString = searchParams?.month || format(new Date(), 'yyyy-MM');
  const monthDate = parse(currentMonthString, 'yyyy-MM', new Date());

  let initialEvents: CalendarEvent[] = [];
  let initialSignups: { [day: string]: AnnouncementSignup } = {};

  if (guildId) {
    const monthKey = format(monthDate, 'yyyy-MM');
    [initialEvents, initialSignups] = await Promise.all([
        getCalendarEvents(guildId),
        getAnnouncementSignups(guildId, monthKey)
    ]);
  }

  const isEmbedded = !!searchParams?.frame_id;

  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading Calendar...</div>}>
      <CalendarPageContent 
        guildId={guildId} 
        adminDiscordId={session.adminId}
        adminProfile={adminData}
        adminGuilds={adminGuilds}
        selectedGuild={guildId}
        initialEvents={initialEvents}
        initialSignups={initialSignups}
        currentMonthString={currentMonthString}
        isEmbedded={isEmbedded}
      />
    </Suspense>
  );
}

export default CalendarPageWrapper;
