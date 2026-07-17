import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WeeklyReportRow {
  id: string;
  account_id: string;
  week_start: string;
  week_end: string;
  pdf_url: string;
  metrics_json: any;
  generated_at: string;
}

export function useWeeklyReports(accountId?: string) {
  return useQuery({
    queryKey: ['weekly-reports', accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<WeeklyReportRow[]> => {
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('account_id', accountId!)
        .order('week_start', { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data as WeeklyReportRow[]) || [];
    },
  });
}

export function useGenerateWeeklyReport(accountId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-weekly-report', {
        body: { accountId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weekly-reports', accountId] });
    },
  });
}
