
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useTransition,
} from 'react';
import { updateSelectedGuild } from '@/app/actions';
import { usePathname, useRouter } from 'next/navigation';

interface AdminGuild {
  id: string;
  name: string;
  icon: string | null;
}

interface CommunityContextType {
  adminId: string | null;
  selectedGuild: string | null;
  adminGuilds: AdminGuild[];
  loading: boolean;
  setAdminId: (id: string | null) => void;
  setSelectedGuild: (id: string | null) => void;
}

const CommunityContext = createContext<CommunityContextType | undefined>(
  undefined
);

export function CommunityProvider({
  children,
  initialAdminId,
  initialSelectedGuild,
  initialAdminGuilds,
}: {
  children: ReactNode;
  initialAdminId: string | null;
  initialSelectedGuild: string | null;
  initialAdminGuilds: AdminGuild[];
}) {
  const [adminId, setAdminIdState] = useState<string | null>(null);
  const [selectedGuild, setSelectedGuildState] = useState<string | null>(null);
  const [adminGuilds, setAdminGuilds] = useState<AdminGuild[]>(initialAdminGuilds);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const storedAdminId = localStorage.getItem('adminDiscordId');
      const storedGuildId = localStorage.getItem('selectedGuildId');
      setAdminIdState(initialAdminId ?? storedAdminId);
      setSelectedGuildState(initialSelectedGuild ?? storedGuildId);
    } catch (error) {
      console.warn('Could not access localStorage for session initialization.');
      setAdminIdState(initialAdminId);
      setSelectedGuildState(initialSelectedGuild);
    } finally {
      setLoading(false);
    }
  }, [initialAdminId, initialSelectedGuild]);
  
  useEffect(() => {
    setAdminGuilds(initialAdminGuilds);
  }, [initialAdminGuilds]);

  const setAdminId = (id: string | null) => {
    setAdminIdState(id);
    try {
      if (id) {
        localStorage.setItem('adminDiscordId', id);
      } else {
        localStorage.removeItem('adminDiscordId');
      }
    } catch (error) {
      console.warn('localStorage not available for adminId.');
    }
  };

  const setSelectedGuild = (id: string | null) => {
    setSelectedGuildState(id);
    try {
      if (id) {
        localStorage.setItem('selectedGuildId', id);
        startTransition(() => {
          updateSelectedGuild(id).then(() => {
            // Check if we are on a page that depends on guildId, and if so, refresh
            if (pathname !== '/settings') {
                router.refresh();
            }
          });
        });
      } else {
        localStorage.removeItem('selectedGuildId');
      }
    } catch (error) {
      console.warn('localStorage not available for selectedGuildId.');
    }
  };

  return (
    <CommunityContext.Provider
      value={{
        adminId,
        selectedGuild,
        adminGuilds,
        loading: loading || isPending,
        setAdminId,
        setSelectedGuild,
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunity() {
  const context = useContext(CommunityContext);
  if (context === undefined) {
    throw new Error('useCommunity must be used within a CommunityProvider');
  }
  return context;
}
