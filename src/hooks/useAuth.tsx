import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';

type AppRole = 'admin' | 'manager' | 'user';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isRoleLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  userRole: AppRole;
  managedClientIds: string[];
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [userRole, setUserRole] = useState<AppRole>('user');
  const [managedClientIds, setManagedClientIds] = useState<string[]>([]);
  const [isRoleLoading, setIsRoleLoading] = useState(true);

  const fetchRoleData = async (userId: string) => {
    setIsRoleLoading(true);
    try {
      // Fetch user roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const roleSet = new Set((roles || []).map(r => r.role));
      const admin = roleSet.has('admin');
      const manager = roleSet.has('manager');

      setIsAdmin(admin);
      setIsManager(manager);
      setUserRole(admin ? 'admin' : manager ? 'manager' : 'user');

      // Fetch managed client IDs for managers
      if (manager && !admin) {
        const { data: assignments } = await supabase
          .from('manager_assignments')
          .select('client_user_id')
          .eq('manager_user_id', userId);
        setManagedClientIds((assignments || []).map(a => a.client_user_id));
      } else {
        setManagedClientIds([]);
      }
    } catch (err) {
      console.error('Error fetching role data:', err);
      setIsAdmin(false);
      setIsManager(false);
      setUserRole('user');
      setManagedClientIds([]);
    } finally {
      setIsRoleLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer role fetch to avoid Supabase client deadlock
          setTimeout(() => fetchRoleData(session.user.id), 0);
        } else {
          setIsAdmin(false);
          setIsManager(false);
          setUserRole('user');
          setManagedClientIds([]);
          setIsRoleLoading(false);
        }

        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchRoleData(session.user.id);
      } else {
        setIsRoleLoading(false);
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsManager(false);
    setUserRole('user');
    setManagedClientIds([]);
  };

  return (
    <AuthContext.Provider value={{
      user, session, isLoading, isAdmin, isManager, userRole, managedClientIds,
      signInWithGoogle, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
