
import { redirect } from 'next/navigation';
import { getSession, getAdminInfo, getLiveRaidPiles, getSettings } from '@/app/actions';
import { getLeaderboard } from '@/app/leaderboard/actions';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Swords, Crown, Eye, Link2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { LeaderboardCard } from '@/components/leaderboard-card';
import { Twitch } from '@/components/icons';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { getRuntimeValue } from '@/lib/runtime-config';


async function QuickLinkCard({ guildId }: { guildId: string }) {
    if (!guildId) return null;

    const settings = await getSettings(guildId);
    const appBaseUrl = settings.appBaseUrl || await getRuntimeValue<string>('NEXT_PUBLIC_BASE_URL') || '';
    const quickLink = new URL("/join?action=raid-pile", appBaseUrl).toString();

    // This component will be server-rendered, so interactive copy is not possible here.
    // We will display the link for manual copy.
    return (
        <Card>
            <CardHeader>
                <CardTitle>Quick Join Link</CardTitle>
                <CardDescription>
                    Share this link with community members for a quick and easy way to join the raid pile.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
                <Input value={quickLink} readOnly />
                <Button variant="outline" size="icon" asChild>
                  <a href={quickLink} target="_blank" rel="noopener noreferrer"><Link2/></a>
                </Button>
            </CardContent>
        </Card>
    );
}

export default async function RaidPilePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId) {
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);
  const guildId = adminData?.selectedGuild ?? null;
  const adminGuilds = adminData?.guilds ?? [];
  const isEmbedded = searchParams ? Object.prototype.hasOwnProperty.call(searchParams, 'frame_id') : false;

  const baseUrl = await getRuntimeValue<string>('NEXT_PUBLIC_BASE_URL');
  const parentDomain = baseUrl ? new URL(baseUrl).hostname : 'localhost';

  if (!guildId) {
    const content = (
      <div className="text-center py-8 text-muted-foreground">
        Please select a community in your settings to view the raid pile.
      </div>
    );

    if (isEmbedded) return <div className="p-4 bg-background">{content}</div>;

    return (
        <AppLayout adminProfile={adminData} adminGuilds={adminGuilds} selectedGuild={guildId} notifications={[]}>
            {content}
        </AppLayout>
    );
  }

  const [initialRaidPiles, leaderboardData] = await Promise.all([
    getLiveRaidPiles(guildId),
    getLeaderboard(guildId),
  ]);

  const pileHolder = initialRaidPiles.length > 0 ? initialRaidPiles[0].holder : null;
  const otherLiveUsers =
    initialRaidPiles.length > 0
      ? initialRaidPiles[0].liveUsers.filter((u) => u.twitchId !== pileHolder?.twitchId)
      : [];

  const pageContent = (
     <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-3">
          <Swords className="h-8 w-8 text-primary" />
          Raid Pile
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          The dynamic queue to be the next one raided by the community. Join the
          pile by interacting with the bot in Discord!
        </p>
      </div>

      {pileHolder && (
        <Card key={pileHolder.twitchId} className="overflow-hidden bg-gradient-to-tr from-primary/10 to-card border-primary/20">
          <div className="grid md:grid-cols-3">
            <div className="md:col-span-2 aspect-video bg-muted">
              {parentDomain && (
                <iframe
                  src={`https://player.twitch.tv/?channel=${pileHolder.twitchLogin.toLowerCase()}&parent=${parentDomain}&autoplay=true&muted=true`}
                  height="100%"
                  width="100%"
                  allowFullScreen={true}
                  className="border-0"
                ></iframe>
              )}
            </div>
            <div className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                    <Crown className="text-accent h-6 w-6" />
                    <h3 className="font-headline text-lg">
                       Raid Pile Holder
                    </h3>
                </div>
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 border-2 border-accent">
                    <AvatarImage
                      src={pileHolder.avatarUrl}
                      alt={pileHolder.displayName}
                      data-ai-hint="streamer avatar"
                    />
                    <AvatarFallback>
                      {pileHolder.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 truncate">
                    <p className="font-bold font-headline text-lg truncate">
                      {pileHolder.displayName}
                    </p>
                    <p
                      className="text-sm text-muted-foreground truncate"
                      title={pileHolder.latestGameName}
                    >
                      {pileHolder.latestGameName || "No game specified"}
                    </p>
                  </div>
                </div>
                <p
                  className="text-xs text-muted-foreground mt-2 truncate"
                  title={pileHolder.latestStreamTitle}
                >
                  {pileHolder.latestStreamTitle || "No title"}
                </p>
              </div>
              <Button asChild className="w-full mt-4">
                <Link
                  href={`https://twitch.tv/${pileHolder.twitchLogin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Twitch className="mr-2 h-4 w-4" />
                  Watch on Twitch
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

       <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <QuickLinkCard guildId={guildId} />
             <LeaderboardCard leaderboardData={leaderboardData} isLoading={false} />
        </div>


      {otherLiveUsers.length > 0 && (
         <Card>
            <CardHeader>
                <CardTitle>Next in the Pile ({otherLiveUsers.length})</CardTitle>
                <CardDescription>Other members who are live and waiting.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {otherLiveUsers.map((streamer) => (
                    <Card key={streamer.twitchId} className="flex flex-col overflow-hidden">
                        <div className="relative aspect-video bg-muted rounded-t-lg">
                             <Image
                                src={`https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamer.twitchLogin}-440x248.jpg`}
                                alt={`Thumbnail for ${streamer.displayName}`}
                                fill
                                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 100vw"
                                className="object-cover"
                                data-ai-hint="stream thumbnail"
                               />
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                            <div className="flex items-start gap-3">
                                <Avatar>
                                    <AvatarImage src={streamer.avatarUrl} alt={streamer.displayName} data-ai-hint="streamer avatar" />
                                    <AvatarFallback>{streamer.displayName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                    <p className="font-bold truncate">{streamer.displayName}</p>
                                    <p className="text-xs text-muted-foreground truncate" title={streamer.latestGameName}>
                                        {streamer.latestGameName || 'No game specified'}
                                    </p>
                                </div>
                            </div>
                            <Button asChild className="w-full mt-4">
                                <Link href={`https://twitch.tv/${streamer.twitchLogin}`} target="_blank" rel="noopener noreferrer">
                                    <Eye className="mr-2 h-4 w-4" />
                                    Watch Stream
                                </Link>
                            </Button>
                        </div>
                    </Card>
                ))}
            </CardContent>
        </Card>
      )}

      {!pileHolder && (
         <Card>
            <CardContent>
                 <div className="col-span-full text-center py-16">
                    <p className="text-muted-foreground">
                        No one is in the pile right now.
                    </p>
                </div>
            </CardContent>
         </Card>
      )}
    </div>
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
