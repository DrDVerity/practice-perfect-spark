import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  campaign_id: string | null;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
  // joined
  sender_email?: string;
  sender_practice?: string;
  recipient_email?: string;
  recipient_practice?: string;
}

export const useMessages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', user?.id],
    queryFn: async (): Promise<Message[]> => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const unreadCount = messages.filter(m => m.recipient_id === user?.id && !m.read).length;

  const sendMessage = useMutation({
    mutationFn: async (msg: { recipient_id: string; subject: string; body: string; campaign_id?: string }) => {
      if (!user) throw new Error('Must be logged in');
      const { data, error } = await (supabase as any)
        .from('messages')
        .insert({ ...msg, sender_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', user?.id] });
      toast.success('Message sent');
    },
    onError: (e: Error) => toast.error('Failed to send message', { description: e.message }),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('messages')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', user?.id] });
    },
  });

  return { messages, isLoading, unreadCount, sendMessage, markRead };
};
