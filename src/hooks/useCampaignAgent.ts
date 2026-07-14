/**
 * useCampaignAgent, client wrapper for the Campaign Agent edge functions.
 */
import { useMutation } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

async function invoke<T = any>(fn: string, body: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let details = '';
    const context = error instanceof FunctionsHttpError ? error.context : (error as any)?.context;
    if (context && typeof context.text === 'function') {
      try { details = await context.text(); } catch { /* keep fallback */ }
    }
    throw new Error(formatFunctionError(error.message, details));
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

function formatFunctionError(fallback: string, details: string) {
  if (!details) return fallback;
  try {
    const parsed = JSON.parse(details);
    if (parsed?.preflight?.checks) {
      const failing = parsed.preflight.checks
        .filter((check: PreflightCheck) => !check.ok)
        .slice(0, 4)
        .map((check: PreflightCheck) => `${check.name}${check.message ? `: ${check.message}` : ''}`)
        .join('; ');
      return failing ? `Preflight failed — ${failing}` : parsed.error || fallback;
    }
    if (parsed?.error) return String(parsed.error);
    if (parsed?.message) return String(parsed.message);
  } catch { /* raw text fallback */ }
  const clean = details.trim();
  return clean.length > 500 ? `${fallback}: ${clean.slice(0, 500)}…` : clean;
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
    onSuccess: () => toast.success('Campaign queued for publishing. Bundle.social handoff is running in the background.'),
    onError: (e: Error) => toast.error('Publish failed', { description: e.message }),
  });

  return { runAgent, refreshPlan, preflight, publish };
}
