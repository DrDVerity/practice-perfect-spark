/**
 * useBundleSocial
 *
 * Wraps the Bundle.social edge functions so components stay thin.
 *
 *  - createTeam(profileUserId)     → admin onboarding
 *  - getConnectLink(profileUserId?)→ get OAuth URL for connecting social accounts
 *  - publishPost(postId)           → on-demand immediate publish
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

async function callEdgeFunction<T = any>(
  name: string,
  body: Record<string, any>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const useBundleSocial = () => {
  const queryClient = useQueryClient();

  const createTeam = useMutation({
    mutationFn: async (profileUserId: string) =>
      callEdgeFunction<{ teamId: string; alreadyExisted: boolean }>(
        'bundle-social-create-team',
        { profileUserId }
      ),
    onSuccess: (data, profileUserId) => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      if (!data.alreadyExisted) {
        toast.success('Bundle.social team created');
      }
    },
    onError: (err: Error) =>
      toast.error('Failed to create Bundle.social team', { description: err.message }),
  });

  const getConnectLink = useMutation({
    mutationFn: async (profileUserId?: string) =>
      callEdgeFunction<{ url: string }>(
        'bundle-social-get-connect-link',
        profileUserId ? { profileUserId } : {}
      ),
    onError: (err: Error) =>
      toast.error('Could not generate connection link', { description: err.message }),
  });

  const publishPost = useMutation({
    mutationFn: async (postId: string) =>
      callEdgeFunction<{ success: boolean; bundleSocialPostId?: string; error?: string }>(
        'bundle-social-publish-post',
        { postId }
      ),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Post published successfully');
        queryClient.invalidateQueries({ queryKey: ['channel-with-posts'] });
        queryClient.invalidateQueries({ queryKey: ['campaigns-new'] });
        queryClient.invalidateQueries({ queryKey: ['scheduler-campaign'] });
      } else {
        toast.error('Publish failed', { description: data.error });
      }
    },
    onError: (err: Error) =>
      toast.error('Publish failed', { description: err.message }),
  });

  return { createTeam, getConnectLink, publishPost };
};
