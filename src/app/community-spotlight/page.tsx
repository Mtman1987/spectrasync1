'use client';

import dynamic from 'next/dynamic';

const CommunitySpotlightClient = dynamic(() => import('./community-spotlight-client'), {
  ssr: false,
  loading: () => <div className="flex h-screen w-full items-center justify-center">Loading Community Spotlight...</div>
});

export default function CommunitySpotlightPage() {
  return <CommunitySpotlightClient />;
}
