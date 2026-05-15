import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  user_id: string;
  practice_name: string | null;
  email: string | null;
  website_url: string | null;
  brand_dna_url: string | null;
  target_audience: string | null;
  campaign_focus: string | null;
  ayrshare_profile_id: string | null;   // Ayrshare sub-profile key (agency multi-profile)
  created_at: string;
  updated_at: string;
}

export const useProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async (): Promise<Profile | null> => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as unknown as Profile | null;
    },
    enabled: !!user,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Profile updated!');
    },
    onError: (error) => {
      toast.error('Failed to update profile', { description: error.message });
    },
  });

  // True once this client has an Ayrshare sub-profile provisioned.
  // Social platform OAuth connections live inside that Ayrshare profile.
  const hasSocialToken = !!profile?.ayrshare_profile_id;

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    hasSocialToken,
  };
};
