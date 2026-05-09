import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type KBDocumentType = 'platform_rules' | 'audience_analysis' | 'market_analysis' | 'competitive_landscape' | 'demographics' | 'brand_guidelines' | 'custom' | 'system_prompt';

export interface KBDocument {
  id: string;
  user_id: string;
  title: string;
  doc_type: KBDocumentType;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const DOC_TYPE_LABELS: Record<KBDocumentType, string> = {
  platform_rules: 'Platform Rules',
  audience_analysis: 'Audience Analysis',
  market_analysis: 'Market Analysis',
  competitive_landscape: 'Competitive Landscape',
  demographics: 'Demographics',
  brand_guidelines: 'Brand Guidelines',
  custom: 'Custom',
  system_prompt: 'Agent Instructions',
};

export const getDocTypeLabel = (type: KBDocumentType) => DOC_TYPE_LABELS[type] || type;

/**
 * Knowledge Base hook.
 * @param targetUserId Optional override (e.g. when an admin/manager is viewing a client's KB).
 *                     When provided, queries and inserts use this user_id instead of the logged-in user.
 */
export const useKnowledgeBase = (targetUserId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const effectiveUserId = targetUserId || user?.id;

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['knowledge-base', effectiveUserId],
    queryFn: async (): Promise<KBDocument[]> => {
      if (!effectiveUserId) return [];
      const { data, error } = await (supabase as any)
        .from('knowledge_base')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveUserId,
  });

  const addDocument = useMutation({
    mutationFn: async (doc: { title: string; doc_type: KBDocumentType; content: string; metadata?: Record<string, unknown> }) => {
      if (!effectiveUserId) throw new Error('Must be logged in');
      const { data, error } = await (supabase as any)
        .from('knowledge_base')
        .insert({ ...doc, user_id: effectiveUserId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', effectiveUserId] });
    },
    onError: (error: Error) => {
      toast.error('Failed to save document', { description: error.message });
    },
  });

  const updateDocument = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: string; doc_type?: KBDocumentType; metadata?: Record<string, unknown> }) => {
      if (!user) throw new Error('Must be logged in');
      const { data, error } = await (supabase as any)
        .from('knowledge_base')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', effectiveUserId] });
    },
    onError: (error: Error) => {
      toast.error('Failed to update document', { description: error.message });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Must be logged in');
      const { error } = await (supabase as any)
        .from('knowledge_base')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', effectiveUserId] });
      toast.success('Document deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete document', { description: error.message });
    },
  });

  const getDocsByType = (type: KBDocumentType) => documents.filter(d => d.doc_type === type);

  return {
    documents,
    isLoading,
    addDocument,
    updateDocument,
    deleteDocument,
    getDocsByType,
  };
};
