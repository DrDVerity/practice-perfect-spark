import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const STORAGE_KEY = 'impersonatedUserId';

interface ImpersonatedProfile {
  user_id: string;
  practice_name: string | null;
  email: string | null;
}

interface ImpersonationContextType {
  impersonatedUserId: string | null;
  impersonatedProfile: ImpersonatedProfile | null;
  effectiveUserId: string | null;
  isImpersonating: boolean;
  startImpersonation: (userId: string) => void;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin } = useAuth();
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(() =>
    sessionStorage.getItem(STORAGE_KEY)
  );
  const [impersonatedProfile, setImpersonatedProfile] = useState<ImpersonatedProfile | null>(null);

  // Only admins may impersonate. If a non-admin somehow has the key, clear it.
  useEffect(() => {
    if (impersonatedUserId && user && !isAdmin) {
      sessionStorage.removeItem(STORAGE_KEY);
      setImpersonatedUserId(null);
    }
  }, [impersonatedUserId, user, isAdmin]);

  useEffect(() => {
    if (!impersonatedUserId) {
      setImpersonatedProfile(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('user_id, practice_name, email')
      .eq('user_id', impersonatedUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setImpersonatedProfile(data as ImpersonatedProfile | null);
      });
    return () => { cancelled = true; };
  }, [impersonatedUserId]);

  const startImpersonation = useCallback((userId: string) => {
    sessionStorage.setItem(STORAGE_KEY, userId);
    setImpersonatedUserId(userId);
  }, []);

  const stopImpersonation = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setImpersonatedUserId(null);
    setImpersonatedProfile(null);
  }, []);

  const effectiveUserId = impersonatedUserId || user?.id || null;

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUserId,
        impersonatedProfile,
        effectiveUserId,
        isImpersonating: !!impersonatedUserId,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
};
