/**
 * useContentHub
 *
 * Wraps the generate-content-hub edge function.
 *
 *   getSuggestions(campaignId)   → returns 5 AI-suggested topics
 *   generateHub(campaignId, topic, topicSource) → kicks off blog + video generation
 *   regenerateBlog(campaignId) → rewrites blog + hero/video from strategic plan topic
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

async function callHub<T>(body: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('generate-content-hub', { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const useContentHub = () => {

  /** Returns 5 topic suggestions resonant with the campaign's audience */
  const getSuggestions = useMutation({
    mutationFn: async (campaignId: string) =>
      callHub<{ suggestions: string[] }>({ campaignId, pickSuggestion: true }),
    onError: (err: Error) =>
      toast.error('Could not fetch topic suggestions', { description: err.message }),
  });

  /** Kicks off blog article + YouTube script generation for the chosen topic */
  const generateHub = useMutation({
    mutationFn: async ({
      campaignId,
      topic,
      topicSource,
    }: {
      campaignId: string;
      topic: string;
      topicSource: 'user_provided' | 'ai_suggested';
    }) =>
      callHub<{ jobStarted: boolean; status: string }>({ campaignId, topic, topicSource }),
    onSuccess: () => {
      toast.info('Generating blog article and YouTube script…', { duration: 5000 });
    },
    onError: (err: Error) =>
      toast.error('Content hub generation failed', { description: err.message }),
  });

  /** Rewrites only the blog article/video using the campaign strategic plan as the source of truth */
  const regenerateBlog = useMutation({
    mutationFn: async (campaignId: string) =>
      callHub<{ jobStarted: boolean; status: string }>({
        campaignId,
        regenerateBlogOnly: true,
      }),
    onSuccess: () => {
      toast.info('Regenerating blog from the strategic plan…', { duration: 5000 });
    },
    onError: (err: Error) =>
      toast.error('Blog regeneration failed', { description: err.message }),
  });

  return { getSuggestions, generateHub, regenerateBlog };
};
