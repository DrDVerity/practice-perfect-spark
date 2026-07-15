import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

export type CampaignStatus = 'developing' | 'scheduled' | 'active' | 'ended' | 'canceled';
export type ChannelType = 'social_media' | 'email' | 'sms';
export type PlatformType = 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok' | 'mailchimp' | 'beehive' | 'internal_email' | 'internal_sms';

export interface Campaign {
  id: string;
  user_id: string;
  location_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: CampaignStatus;
  strategy: string | null;
  focus?: string | null;
  target_audience?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignChannel {
  id: string;
  campaign_id: string;
  channel_type: ChannelType;
  platform: PlatformType;
  created_at: string;
  updated_at: string;
}

export interface ChannelPost {
  id: string;
  campaign_channel_id: string;
  title: string | null;
  text_content: string | null;
  image_url: string | null;
  video_url: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: string;
  accepted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignWithChannels extends Campaign {
  campaign_channels: (CampaignChannel & { channel_posts: ChannelPost[] })[];
}

export const useCampaignsNew = () => {
  const { user } = useAuth();
  const { activeLocationId } = useWorkspace();
  const queryClient = useQueryClient();

  // Fetch all campaigns
  const { data: campaigns = [], isLoading, error } = useQuery({
    queryKey: ['campaigns-new', user?.id, activeLocationId],
    queryFn: async (): Promise<Campaign[]> => {
      if (!user || !activeLocationId) return [];

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('location_id', activeLocationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!user && !!activeLocationId,
  });

  // Fetch single campaign with channels and posts
  const useCampaignWithChannels = (campaignId: string | undefined) => {
    return useQuery({
      queryKey: ['campaign-with-channels', campaignId],
      queryFn: async (): Promise<CampaignWithChannels | null> => {
        if (!campaignId) return null;
        
        const { data, error } = await supabase
          .from('campaigns')
          .select(`
            *,
            campaign_channels (
              *,
              channel_posts (*)
            )
          `)
          .eq('id', campaignId)
          .single();
        
        if (error) throw error;
        return data as CampaignWithChannels;
      },
      enabled: !!campaignId,
    });
  };

  // Fetch channels for a campaign
  const useCampaignChannels = (campaignId: string | undefined) => {
    return useQuery({
      queryKey: ['campaign-channels', campaignId],
      queryFn: async (): Promise<CampaignChannel[]> => {
        if (!campaignId) return [];
        
        const { data, error } = await supabase
          .from('campaign_channels')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data as CampaignChannel[];
      },
      enabled: !!campaignId,
    });
  };

  // Fetch single channel with posts
  const useChannelWithPosts = (channelId: string | undefined) => {
    return useQuery({
      queryKey: ['channel-with-posts', channelId],
      queryFn: async () => {
        if (!channelId) return null;
        
        const { data, error } = await supabase
          .from('campaign_channels')
          .select(`
            *,
            channel_posts (*),
            campaigns (*)
          `)
          .eq('id', channelId)
          .single();
        
        if (error) throw error;
        return data;
      },
      enabled: !!channelId,
    });
  };

  // Create campaign
  const createCampaign = useMutation({
    mutationFn: async (campaign: Omit<Campaign, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'location_id'>) => {
      if (!user) throw new Error('Must be logged in');
      if (!activeLocationId) throw new Error('No active location');

      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          ...campaign,
          user_id: user.id,
          location_id: activeLocationId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns-new', user?.id] });
      toast.success('Campaign created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create campaign', { description: error.message });
    },
  });

  // Update campaign
  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Campaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns-new', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-with-channels', variables.id] });
      toast.success('Campaign updated!');
    },
    onError: (error) => {
      toast.error('Failed to update campaign', { description: error.message });
    },
  });

  // Delete campaign
  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey?.[0];
          return typeof k === 'string' && (
            k === 'campaigns-new' ||
            k === 'client-campaigns' ||
            k === 'admin-campaigns' ||
            k === 'manager-campaigns' ||
            k === 'account-campaigns' ||
            k === 'campaigns'
          );
        },
      });
      toast.success('Campaign deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete campaign', { description: error.message });
    },
  });

  // Add channel to campaign
  const addChannel = useMutation({
    mutationFn: async (channel: Omit<CampaignChannel, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('campaign_channels')
        .insert(channel)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-channels', variables.campaign_id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-with-channels', variables.campaign_id] });
      toast.success('Channel added!');
    },
    onError: (error) => {
      toast.error('Failed to add channel', { description: error.message });
    },
  });

  // Remove channel
  const removeChannel = useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await supabase
        .from('campaign_channels')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { campaignId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-channels', result.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-with-channels', result.campaignId] });
      toast.success('Channel removed');
    },
    onError: (error) => {
      toast.error('Failed to remove channel', { description: error.message });
    },
  });

  // Add post to channel
  const addPost = useMutation({
    mutationFn: async (post: Omit<ChannelPost, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('channel_posts')
        .insert(post)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channel-with-posts', variables.campaign_channel_id] });
      toast.success('Post added!');
    },
    onError: (error) => {
      toast.error('Failed to add post', { description: error.message });
    },
  });

  // Update post — optimistic: patch the cached channel-with-posts entry immediately
  // so the UI (e.g. Accept toggle) flips instantly, then rolls back on error.
  const updatePost = useMutation({
    mutationFn: async ({ id, channelId, ...updates }: Partial<ChannelPost> & { id: string; channelId: string }) => {
      const { data, error } = await supabase
        .from('channel_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, channelId };
    },
    onMutate: async ({ id, channelId, ...updates }) => {
      const key = ['channel-with-posts', channelId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<any>(key);
      if (previous) {
        const nextPosts = (previous.channel_posts || []).map((p: any) =>
          p.id === id ? { ...p, ...updates } : p,
        );
        queryClient.setQueryData(key, { ...previous, channel_posts: nextPosts });
      }
      return { previous, channelId };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['channel-with-posts', context.channelId], context.previous);
      }
      toast.error('Failed to update post', { description: (error as Error).message });
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channel-with-posts', variables.channelId] });
    },
  });

  // Delete post
  const deletePost = useMutation({
    mutationFn: async ({ id, channelId }: { id: string; channelId: string }) => {
      const { error } = await supabase
        .from('channel_posts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { channelId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['channel-with-posts', result.channelId] });
      toast.success('Post deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete post', { description: error.message });
    },
  });

  // Accept all draft/scheduled posts in a channel
  const acceptAllPosts = useMutation({
    mutationFn: async ({ channelId }: { channelId: string }) => {
      const { error } = await supabase
        .from('channel_posts')
        .update({ accepted: true })
        .eq('campaign_channel_id', channelId);
      if (error) throw error;
      return { channelId };
    },
    onMutate: async ({ channelId }) => {
      const key = ['channel-with-posts', channelId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<any>(key);
      if (previous) {
        const nextPosts = (previous.channel_posts || []).map((p: any) => ({ ...p, accepted: true }));
        queryClient.setQueryData(key, { ...previous, channel_posts: nextPosts });
      }
      return { previous, channelId };
    },
    onSuccess: () => {
      toast.success('All posts accepted');
    },
    onError: (error, _vars, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(['channel-with-posts', context.channelId], context.previous);
      }
      toast.error('Failed to accept posts', { description: error.message });
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channel-with-posts', variables.channelId] });
    },
  });

  return {
    campaigns,
    isLoading,
    error,
    useCampaignWithChannels,
    useCampaignChannels,
    useChannelWithPosts,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    addChannel,
    removeChannel,
    addPost,
    updatePost,
    deletePost,
    acceptAllPosts,
  };
};
