import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CampaignVault {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  text_copy: string | null;
  platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter';
  status: 'draft' | 'scheduled' | 'published';
  scheduled_date: string | null;
  target_audience: string | null;
  created_at: string;
  updated_at: string;
}

export const useCampaigns = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading, error } = useQuery({
    queryKey: ['campaigns', user?.id],
    queryFn: async (): Promise<CampaignVault[]> => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('campaign_vault')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CampaignVault[];
    },
    enabled: !!user,
  });

  const saveCampaign = useMutation({
    mutationFn: async (campaign: Omit<CampaignVault, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('campaign_vault')
        .insert({
          ...campaign,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', user?.id] });
      toast.success('Campaign saved successfully!');
    },
    onError: (error) => {
      toast.error('Failed to save campaign', { description: error.message });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CampaignVault> & { id: string }) => {
      const { data, error } = await supabase
        .from('campaign_vault')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', user?.id] });
      toast.success('Campaign updated!');
    },
    onError: (error) => {
      toast.error('Failed to update campaign', { description: error.message });
    },
  });

  const scheduleCampaign = useMutation({
    mutationFn: async ({ id, scheduledDate }: { id: string; scheduledDate: Date }) => {
      const { data, error } = await supabase
        .from('campaign_vault')
        .update({
          scheduled_date: scheduledDate.toISOString(),
          status: 'scheduled',
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', user?.id] });
      toast.success('Campaign scheduled!');
    },
    onError: (error) => {
      toast.error('Failed to schedule campaign', { description: error.message });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaign_vault')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', user?.id] });
      toast.success('Campaign deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete campaign', { description: error.message });
    },
  });

  return {
    campaigns,
    isLoading,
    error,
    saveCampaign,
    updateCampaign,
    scheduleCampaign,
    deleteCampaign,
  };
};
