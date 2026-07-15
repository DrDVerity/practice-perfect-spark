import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DailyMetricRow {
  id: string;
  campaign_id: string;
  channel_id: string | null;
  platform: string;
  date: string;
  impressions: number;
  views: number;
  clicks: number;
  leads: number;
  appointments: number;
  spend: number;
  is_test: boolean;
}

export interface FinancialRow {
  id: string;
  campaign_id: string;
  month: string;
  spend: number;
  new_patients: number;
  avg_patient_value: number;
  revenue: number;
  is_test: boolean;
}

/** Daily metrics for a single campaign, across all platforms. */
export function useCampaignDailyMetrics(campaignId?: string) {
  return useQuery({
    queryKey: ['campaign-daily-metrics', campaignId],
    enabled: !!campaignId,
    queryFn: async (): Promise<DailyMetricRow[]> => {
      const { data, error } = await supabase
        .from('campaign_daily_metrics')
        .select('*')
        .eq('campaign_id', campaignId!)
        .order('date', { ascending: true });
      if (error) throw error;
      return (data as DailyMetricRow[]) || [];
    },
  });
}

/** All financials rows for a set of campaigns (annual ROI chart). */
export function useCampaignFinancials(campaignIds: string[]) {
  const key = [...campaignIds].sort().join(',');
  return useQuery({
    queryKey: ['campaign-financials', key],
    enabled: campaignIds.length > 0,
    queryFn: async (): Promise<FinancialRow[]> => {
      const { data, error } = await supabase
        .from('campaign_financials')
        .select('*')
        .in('campaign_id', campaignIds)
        .order('month', { ascending: true });
      if (error) throw error;
      return (data as FinancialRow[]) || [];
    },
  });
}

/** Total impressions / clicks / leads / appts / spend across a campaign set. */
export function useCampaignKpiTotals(campaignIds: string[]) {
  const key = [...campaignIds].sort().join(',');
  return useQuery({
    queryKey: ['campaign-kpi-totals', key],
    enabled: campaignIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_daily_metrics')
        .select('impressions, clicks, views, leads, appointments, spend')
        .in('campaign_id', campaignIds);
      if (error) throw error;
      const rows = (data || []) as any[];
      const totals = rows.reduce(
        (acc, r) => {
          acc.impressions += r.impressions || 0;
          acc.views += r.views || 0;
          acc.clicks += r.clicks || 0;
          acc.leads += r.leads || 0;
          acc.appointments += r.appointments || 0;
          acc.spend += Number(r.spend) || 0;
          return acc;
        },
        { impressions: 0, views: 0, clicks: 0, leads: 0, appointments: 0, spend: 0 },
      );
      return totals;
    },
  });
}

/** Monthly-bucketed aggregate metrics across a set of campaigns. */
export function useCampaignMonthlyMetrics(campaignIds: string[]) {
  const key = [...campaignIds].sort().join(',');
  return useQuery({
    queryKey: ['campaign-monthly-metrics', key],
    enabled: campaignIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_daily_metrics')
        .select('date, impressions, clicks, leads, appointments')
        .in('campaign_id', campaignIds);
      if (error) throw error;
      const buckets: Record<string, { month: string; impressions: number; clicks: number; leads: number; appointments: number }> = {};
      for (const r of (data || []) as any[]) {
        const month = String(r.date).slice(0, 7);
        buckets[month] ??= { month, impressions: 0, clicks: 0, leads: 0, appointments: 0 };
        buckets[month].impressions += r.impressions || 0;
        buckets[month].clicks += r.clicks || 0;
        buckets[month].leads += r.leads || 0;
        buckets[month].appointments += r.appointments || 0;
      }
      return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
    },
  });
}

