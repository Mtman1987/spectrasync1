
// src/app/page.tsx (Server Component)
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { CosmicRaidLogo } from "@/components/icons";

export default async function HomePage() {
  const session = await getSession();

  // If the user is already logged in, send them straight to the dashboard.
  if (session.isLoggedIn) {
    redirect('/dashboard');
  }

  return (
    <SetupPage>
      <p className="text-muted-foreground mb-6">
        The suite of powerful tools to help you manage, engage, and grow your Twitch community.
      </p>
      <a
        href="/api/auth/discord"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        Login with Discord
      </a>
    </SetupPage>
  );
}

function SetupPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="max-w-2xl text-center w-full">
        <CosmicRaidLogo className="h-16 w-16 mx-auto text-primary mb-4" />
        <h1 className="text-4xl font-bold font-headline mb-2">
            Welcome to Cosmic Raid
        </h1>
        {children}
      </div>
    </div>
  );
}
