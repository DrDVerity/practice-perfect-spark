import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ChannelCredential {
  id: string;
  user_id: string;
  platform_name: string;
  platform_url: string | null;
  username: string | null;
  password: string | null;
  created_at: string;
  updated_at: string;
}

// FIX #3: All mutations now use the same key shape ['channel_credentials', userId]
// so invalidation actually hits the registered query.
export const useChannelCredentials = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Stable query key includes userId so each user gets an isolated cache entry
  const queryKey = ['channel_credentials', user?.id] as const;

  const { data: credentials = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<ChannelCredential[]> => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from('channel_credentials')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000, // FIX #10: credentials rarely change — 60s stale window
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const addCredential = useMutation({
    mutationFn: async (cred: {
      platform_name: string;
      platform_url?: string;
      username?: string;
      password?: string;
    }) => {
      if (!user) throw new Error('Must be logged in');
      const { data, error } = await (supabase as any)
        .from('channel_credentials')
        .insert({ ...cred, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success('Channel connected'); },
    onError: (e: Error) => toast.error('Failed to save credential', { description: e.message }),
  });

  const updateCredential = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      platform_name?: string;
      platform_url?: string | null;
      username?: string | null;
      password?: string | null;
    }) => {
      const { data, error } = await (supabase as any)
        .from('channel_credentials')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success('Credential updated'); },
    onError: (e: Error) => toast.error('Failed to update credential', { description: e.message }),
  });

  const deleteCredential = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('channel_credentials')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Credential removed'); },
    onError: (e: Error) => toast.error('Failed to remove credential', { description: e.message }),
  });

  return { credentials, isLoading, addCredential, updateCredential, deleteCredential };
};
