'use client';

import dynamic from 'next/dynamic';

const TeamChatClient = dynamic(() => import('./team-chat-client'), {
  ssr: false,
  loading: () => <div className="flex h-screen w-full items-center justify-center">Loading Team Chat...</div>
});

export default function TeamChatPage() {
  return <TeamChatClient />;
}