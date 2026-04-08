import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CampaignBudget {
  id: string;
  campaign_id: string;
  total_amount: number;
  allocations: Record<string, { percent: number; amount: number }>;
  accepted: boolean;
  created_at: string;
  updated_at: string;
}

export const useCampaignBudget = (campaignId?: string) => {
  const queryClient = useQueryClient();

  const { data: budget, isLoading } = useQuery({
    queryKey: ['campaign-budget', campaignId],
    queryFn: async (): Promise<CampaignBudget | null> => {
      if (!campaignId) return null;
      const { data, error } = await (supabase as any)
        .from('campaign_budgets')
        .select('*')
        .eq('campaign_id', campaignId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const upsertBudget = useMutation({
    mutationFn: async (input: { campaign_id: string; total_amount: number; allocations: Record<string, { percent: number; amount: number }>; accepted?: boolean }) => {
      // Try update first, then insert
      if (budget?.id) {
        const { data, error } = await (supabase as any)
          .from('campaign_budgets')
          .update({
            total_amount: input.total_amount,
            allocations: input.allocations,
            accepted: input.accepted ?? true,
          })
          .eq('id', budget.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase as any)
          .from('campaign_budgets')
          .insert({
            campaign_id: input.campaign_id,
            total_amount: input.total_amount,
            allocations: input.allocations,
            accepted: input.accepted ?? true,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-budget', campaignId] });
    },
    onError: (e: Error) => toast.error('Failed to save budget', { description: e.message }),
  });

  return { budget, isLoading, upsertBudget };
};
