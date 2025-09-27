"use client";

import { useEffect, useState } from "react";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useCommunity } from "@/context/community-context";

type Notification = {
    title: string;
    description: string;
    href: string;
}

export function AppHeader({ initialNotifications }: { initialNotifications: Notification[] }) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const { state } = useSidebar();
  const { selectedGuild, adminGuilds } = useCommunity();

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  const guildInfo = adminGuilds.find(g => g.id === selectedGuild);
  
  return (
    <header className={cn(
      "flex h-14 items-center justify-between gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30 transition-all duration-300 ease-in-out",
      "md:pl-[var(--sidebar-width-icon)]",
      state === 'expanded' && "md:pl-[var(--sidebar-width)]"
    )}>
      <SidebarTrigger className="md:hidden" />
      
      <div className="flex-1" />

       <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="relative">
                        <Bell className="h-4 w-4" />
                        {notifications.length > 0 && (
                            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive border-2 border-card" />
                        )}
                        <span className="sr-only">Notifications</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notifications.length > 0 ? notifications.map((notification, index) => (
                         <DropdownMenuItem key={index} asChild>
                            <Link href={notification.href} className="flex flex-col items-start gap-1">
                                <p className="font-semibold">{notification.title}</p>
                                <p className="text-xs text-muted-foreground">{notification.description}</p>
                            </Link>
                         </DropdownMenuItem>
                    )) : (
                        <DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {guildInfo && (
                <div className="flex items-center gap-2">
                <span className="font-semibold text-sm hidden sm:inline-block">{guildInfo.name}</span>
                <Avatar className="h-8 w-8">
                    <AvatarImage src={guildInfo.icon ? `https://cdn.discordapp.com/icons/${guildInfo.id}/${guildInfo.icon}.png` : undefined} alt={guildInfo.name} />
                    <AvatarFallback>{guildInfo.name.charAt(0)}</AvatarFallback>
                </Avatar>
                </div>
            )}
       </div>
    </header>
  )
}
