'use server';
"use client";

import { useRouter } from "next/navigation";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { logout } from "@/app/actions";

type UserProfile = {
  discordInfo?: {
    id: string;
    username: string;
    avatar: string;
  };
  twitchInfo?: {
    id: string;
    login: string;
    displayName: string;
    avatar: string;
  };
}

export function UserNav({ user }: { user: UserProfile | null }) {
  const router = useRouter();
  const { state } = useSidebar();
  
  const handleLogout = async () => {
    await logout();
    router.push('/');
    router.refresh();
  }

  if (!user?.discordInfo) {
     return (
        <div className="flex items-center gap-2 p-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className={cn("flex-col gap-1", state === 'collapsed' ? 'hidden' : 'flex')}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
     );
  }
    
  const displayUser = user.discordInfo;
  const displayName = user.twitchInfo?.displayName || displayUser.username;
  const displaySubtext = user.twitchInfo?.login || user.discordInfo.username;
  const displayAvatar = user.twitchInfo?.avatar || displayUser.avatar;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={cn("flex items-center gap-2 p-2 w-full h-auto", state === 'collapsed' && 'w-auto aspect-square justify-center h-10')}>
              <Avatar className={cn(state === 'collapsed' && 'h-8 w-8')}>
                  <AvatarImage src={displayAvatar || undefined} data-ai-hint="person avatar" alt={displayName} />
                  <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className={cn("flex flex-col items-start", state === 'collapsed' && 'hidden')}>
                  <span className="font-semibold text-sm">{displayName}</span>
                  <span className="text-xs text-muted-foreground">{displaySubtext}</span>
              </div>
          </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
