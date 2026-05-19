import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AccountRow {
  id: string;
  name: string;
  owner_user_id: string;
}

export interface LocationRow {
  id: string;
  account_id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  is_default: boolean;
}

interface WorkspaceContextType {
  account: AccountRow | null;
  locations: LocationRow[];
  activeLocation: LocationRow | null;
  activeLocationId: string | null;
  accountId: string | null;
  isLoading: boolean;
  isOwner: boolean;
  setActiveLocation: (id: string) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = 'activeLocationId';

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [activeLocationId, setActiveLocationIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setAccount(null);
      setLocations([]);
      setIsOwner(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Find primary account membership
      const { data: memberships } = await supabase
        .from('account_members')
        .select('account_id, role')
        .eq('user_id', user.id);

      if (!memberships || memberships.length === 0) {
        setAccount(null);
        setLocations([]);
        setIsOwner(false);
        return;
      }

      const owned = memberships.find((m) => m.role === 'owner');
      const primary = owned || memberships[0];
      setIsOwner(primary.role === 'owner');

      const { data: acc } = await supabase
        .from('accounts')
        .select('id, name, owner_user_id')
        .eq('id', primary.account_id)
        .maybeSingle();
      setAccount(acc as AccountRow | null);

      // Locations the user can access in this account
      const { data: locs } = await supabase
        .from('locations')
        .select('id, account_id, name, address, timezone, is_default')
        .eq('account_id', primary.account_id)
        .order('is_default', { ascending: false })
        .order('name');

      const locList = (locs || []) as LocationRow[];
      setLocations(locList);

      // Pick active: stored if still valid, else default, else first
      setActiveLocationIdState((prev) => {
        if (prev && locList.some((l) => l.id === prev)) return prev;
        const def = locList.find((l) => l.is_default) || locList[0];
        return def?.id || null;
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const setActiveLocation = useCallback((id: string) => {
    setActiveLocationIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeLocation = useMemo(
    () => locations.find((l) => l.id === activeLocationId) || null,
    [locations, activeLocationId]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        account,
        locations,
        activeLocation,
        activeLocationId,
        accountId: account?.id ?? null,
        isLoading,
        isOwner,
        setActiveLocation,
        refresh: load,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
};
