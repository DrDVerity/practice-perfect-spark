/**
 * useCampaignAgent, client wrapper for the Campaign Agent edge functions.
 */
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

async function invoke<T = any>(fn: string, body: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export interface PreflightCheck { id: string; name: string; ok: boolean; message?: string }
export interface PreflightResult { ok: boolean; checks: PreflightCheck[] }

export function useCampaignAgent() {
  const runAgent = useMutation({
    mutationFn: (input: { campaignId: string; topic?: string }) =>
      invoke('run-campaign-agent', input),
    onSuccess: () =>
      toast.info('The Campaign Agent is working, plan, blog, and posts will appear as they’re ready.'),
    onError: (e: Error) =>
      toast.error('Could not start the Campaign Agent', { description: e.message }),
  });

  const refreshPlan = useMutation({
    mutationFn: (campaignId: string) => invoke('refresh-strategic-plan', { campaignId }),
    onSuccess: () => toast.info('Refreshing the strategic plan…'),
    onError: (e: Error) => toast.error('Failed to refresh plan', { description: e.message }),
  });

  const preflight = useMutation({
    mutationFn: (campaignId: string) => invoke<PreflightResult>('publish-campaign-preflight', { campaignId }),
    onError: (e: Error) => toast.error('Preflight failed', { description: e.message }),
  });

  const publish = useMutation({
    mutationFn: (campaignId: string) => invoke('publish-campaign', { campaignId }),
    onSuccess: () => toast.success('Campaign published, handed off to Bundle.social.'),
    onError: (e: Error) => toast.error('Publish failed', { description: e.message }),
  });

  return { runAgent, refreshPlan, preflight, publish };
}
