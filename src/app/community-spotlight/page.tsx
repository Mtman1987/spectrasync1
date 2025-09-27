
'use client';

import dynamic from 'next/dynamic';
import { AppLayout } from "@/components/layout/app-layout";
import { Sparkles } from "lucide-react";
import { UserContentGenerator } from "@/app/community-spotlight/user-content-generator";
import ContentHistory from "./content-history";

const CommunitySpotlightClient = dynamic(() => import('./community-spotlight-client'), {
  ssr: false,
  loading: () => <div className="flex h-screen w-full items-center justify-center">Loading Community Spotlight...</div>
});

export default function CommunitySpotlightPage() {
  return (
    <AppLayout>
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
