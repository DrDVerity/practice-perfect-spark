import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CampaignMessage {
  id: string;
  account_id: string;
  campaign_id: string | null;
  sender_user_id: string | null;
  sender_display: string | null;
  sender_address: string | null;
  recipient_type: 'manager' | 'client' | 'vendor';
  recipient_address: string;
  type: 'email' | 'sms';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string;
  external_message_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const useCampaignMessages = (campaignId: string | null) => {
  const { accountId } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();

  const key = ['campaign_messages', accountId, campaignId];

  const { data: messages = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<CampaignMessage[]> => {
      if (!accountId) return [];
      let q = (supabase as any)
        .from('campaign_messages')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });
      q = campaignId ? q.eq('campaign_id', campaignId) : q.is('campaign_id', null);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (!accountId) return;
    const ch = supabase
      .channel(`campaign_messages_${accountId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_messages', filter: `account_id=eq.${accountId}` },
        () => qc.invalidateQueries({ queryKey: ['campaign_messages', accountId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [accountId, qc]);

  const send = useMutation({
    mutationFn: async (payload: {
      type: 'email' | 'sms';
      recipient_type: 'manager' | 'client' | 'vendor';
      recipient_address: string;
      subject?: string;
      body: string;
    }) => {
      if (!user || !accountId) throw new Error('Not ready');
      const { data, error } = await supabase.functions.invoke('send-campaign-message', {
        body: { ...payload, account_id: accountId, campaign_id: campaignId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign_messages', accountId] });
    },
    onError: (e: Error) => toast.error('Failed to send', { description: e.message }),
  });

  return { messages, isLoading, send };
};
