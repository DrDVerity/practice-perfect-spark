import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CampaignAddon {
  id: string;
  campaign_id: string;
  addon_type: string;
  notes: string | null;
  // FIX #1: custom_label + custom_icon now persisted in DB (Migration E)
  custom_label: string | null;
  custom_icon: string | null;
  created_at: string;
}

export const useCampaignAddons = (campaignId?: string) => {
  const queryClient = useQueryClient();
  const queryKey = ['campaign-addons', campaignId] as const;

  const { data: addons = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<CampaignAddon[]> => {
      if (!campaignId) return [];
      const { data, error } = await (supabase as any)
        .from('campaign_addons')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!campaignId,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const addAddon = useMutation({
    mutationFn: async (addon: {
      campaign_id: string;
      addon_type: string;
      notes?: string;
      custom_label?: string;   // persisted for custom vectors
      custom_icon?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from('campaign_addons')
        .insert(addon)
        .select()
        .single();
      if (error) throw error;

      // Notify account manager (or admins if none assigned) — vectors
      // require ad-spend investment and manager implementation.
      try {
        await supabase.functions.invoke('notify-manager-vector', {
          body: {
            campaignId: addon.campaign_id,
            addonType: addon.addon_type,
            addonLabel: addon.custom_label || addon.addon_type,
          },
        });
      } catch (e) {
        console.warn('notify-manager-vector skipped', e);
      }

      return data;
    },
    onSuccess: () => { invalidate(); toast.success('Add-on included — account manager notified'); },
    onError: (e: Error) => toast.error('Failed to add', { description: e.message }),
  });

  const removeAddon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('campaign_addons')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Add-on removed'); },
    onError: (e: Error) => toast.error('Failed to remove', { description: e.message }),
  });

  return { addons, isLoading, addAddon, removeAddon };
};
