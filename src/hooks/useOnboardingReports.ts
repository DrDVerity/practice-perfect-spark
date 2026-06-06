import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type OnboardingReportsStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'error'
  | null;

export interface OnboardingReportsState {
  status: OnboardingReportsStatus;
  total: number;
  done: number;
  error: string | null;
  website_url: string | null;
  bundle_social_team_id: string | null;
}

/**
 * Drives the automatic onboarding research-report suite for a practice.
 *
 * - Reads generation status from the profile (polls while running).
 * - `trigger()` invokes the generate-onboarding-reports edge function.
 * - The server only starts when a website URL AND a connected social account
 *   exist; otherwise it returns 'awaiting_social' / 'missing_website' and the
 *   profile status is left untouched.
 *
 * @param targetUserId  The practice owner's user_id (self, or a client when an
 *                      admin/manager is viewing their dashboard).
 */
export const useOnboardingReports = (targetUserId?: string | null) => {
  const queryClient = useQueryClient();

  const { data: state } = useQuery({
    queryKey: ['onboarding-reports', targetUserId],
    enabled: !!targetUserId,
    refetchInterval: (query) =>
      (query.state.data as OnboardingReportsState | undefined)?.status === 'running'
        ? 5000
        : false,
    queryFn: async (): Promise<OnboardingReportsState | null> => {
      if (!targetUserId) return null;
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select(
          'onboarding_reports_status, onboarding_reports_total, onboarding_reports_done, onboarding_reports_error, website_url, bundle_social_team_id',
        )
        .eq('user_id', targetUserId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const d = data as any;
      return {
        status: d.onboarding_reports_status ?? 'pending',
        total: d.onboarding_reports_total ?? 0,
        done: d.onboarding_reports_done ?? 0,
        error: d.onboarding_reports_error ?? null,
        website_url: d.website_url ?? null,
        bundle_social_team_id: d.bundle_social_team_id ?? null,
      };
    },
  });

  const trigger = useMutation({
    mutationFn: async (opts?: { force?: boolean; silent?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('generate-onboarding-reports', {
        body: { userId: targetUserId || undefined, force: opts?.force === true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { status: string; message?: string };
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-reports', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      if (vars?.silent) return;
      if (data.status === 'running') {
        toast.success('Research started', { description: 'Generating your practice reports — this takes a couple of minutes.' });
      } else if (data.status === 'awaiting_social') {
        toast.info('Connect a social account', { description: data.message });
      } else if (data.status === 'missing_website') {
        toast.info('Add a website URL first', { description: data.message });
      } else if (data.status === 'complete') {
        toast.success('Reports are ready', { description: 'View them in the Knowledge Base.' });
      }
    },
    onError: (err: any, vars) => {
      if (vars?.silent) return;
      toast.error('Could not start research', { description: err.message });
    },
  });

  return {
    state: state ?? null,
    isRunning: state?.status === 'running',
    isComplete: state?.status === 'complete',
    trigger,
  };
};
