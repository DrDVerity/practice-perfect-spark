/**
 * useAyrshare
 *
 * Wraps the three Ayrshare edge functions so components stay thin.
 *
 *  - createProfile(profileUserId)  → admin onboarding
 *  - getSocialLink(profileUserId?) → get OAuth URL for connecting social accounts
 *  - publishPost(postId)           → on-demand immediate publish
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── helpers ───────────────────────────────────────────────────────────────────

async function callEdgeFunction<T = any>(
  name: string,
  body: Record<string, any>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

// ── hook ──────────────────────────────────────────────────────────────────────

export const useAyrshare = () => {
  const queryClient = useQueryClient();

  /**
   * createProfile
   * Called by CreateClientDialog after inserting a new profiles row.
   * Provisions the Ayrshare sub-profile and saves the profileKey back to Supabase.
   */
  const createProfile = useMutation({
    mutationFn: async (profileUserId: string) =>
      callEdgeFunction<{ profileKey: string; alreadyExisted: boolean }>(
        'ayrshare-create-profile',
        { profileUserId }
      ),
    onSuccess: (data, profileUserId) => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      if (!data.alreadyExisted) {
        toast.success('Ayrshare profile created');
      }
    },
    onError: (err: Error) =>
      toast.error('Failed to create Ayrshare profile', { description: err.message }),
  });

  /**
   * getSocialLink
   * Returns the Ayrshare-hosted OAuth URL for a given user.
   * Opens in a new tab so the user can connect Facebook, Instagram, etc.
   */
  const getSocialLink = useMutation({
    mutationFn: async (profileUserId?: string) =>
      callEdgeFunction<{ url: string }>(
        'ayrshare-get-social-link',
        profileUserId ? { profileUserId } : {}
      ),
    onError: (err: Error) =>
      toast.error('Could not generate social link', { description: err.message }),
  });

  /**
   * publishPost
   * On-demand publish of a single channel_post.
   * On success, invalidates related queries so the UI reflects the new status.
   */
  const publishPost = useMutation({
    mutationFn: async (postId: string) =>
      callEdgeFunction<{ success: boolean; ayrsharePostId?: string; error?: string }>(
        'ayrshare-publish-post',
        { postId }
      ),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Post published successfully');
        // Invalidate all post-related queries so status updates everywhere
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

  return { createProfile, getSocialLink, publishPost };
};
