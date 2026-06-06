import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
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
  bundle_social_team_id: string | null;   // Bundle.social team ID (own or owner's)
  onboarding_reports_status: 'pending' | 'running' | 'complete' | 'error' | null;
  onboarding_reports_total: number | null;
  onboarding_reports_done: number | null;
  onboarding_reports_error: string | null;
  created_at: string;
  updated_at: string;
}

export const useProfile = () => {
  const { user } = useAuth();
  const { effectiveUserId, isImpersonating } = useImpersonation();
  const targetUserId = effectiveUserId || user?.id || null;
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', targetUserId],
    queryFn: async (): Promise<Profile | null> => {
      if (!targetUserId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Resolve effective Bundle.social team: if this user is a team member
      // (not the account owner), surface the account owner's team id so the UI
      // shows them as connected and uses the owner's connected channels.
      let teamId = (data as any).bundle_social_team_id as string | null;
      try {
        const { data: rpcTeam } = await supabase.rpc(
          'bundle_social_team_for_user' as any,
          { _user_id: targetUserId },
        );
        if (rpcTeam) teamId = rpcTeam as unknown as string;
      } catch {
        // Helper is optional; fall back to own column.
      }

      return { ...(data as any), bundle_social_team_id: teamId } as Profile;
    },
    enabled: !!targetUserId,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!targetUserId) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', targetUserId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', targetUserId] });
      toast.success('Profile updated!');
    },
    onError: (error) => {
      toast.error('Failed to update profile', { description: error.message });
    },
  });

  const hasSocialToken = !!profile?.bundle_social_team_id;
  const hasBundleSocialTeam = hasSocialToken;

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    hasSocialToken,
    hasBundleSocialTeam,
    isImpersonating,
  };
};
