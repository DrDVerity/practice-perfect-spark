import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

export type KBDocumentType = 'platform_rules' | 'audience_analysis' | 'market_analysis' | 'competitive_landscape' | 'demographics' | 'brand_guidelines' | 'custom' | 'system_prompt';
export type KBScope = 'group' | 'location';

export interface KBDocument {
  id: string;
  user_id: string;
  account_id: string;
  location_id: string | null;
  scope: KBScope;
  title: string;
  doc_type: KBDocumentType;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const KB_FILE_URL_TTL_SECONDS = 60 * 60 * 24;

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
export const useKnowledgeBase = (targetUserId?: string, scope?: KBScope) => {
  const { user } = useAuth();
  const { accountId, activeLocationId } = useWorkspace();
  const queryClient = useQueryClient();

  const effectiveUserId = targetUserId || user?.id;

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['knowledge-base', effectiveUserId, accountId, activeLocationId, scope],
    queryFn: async (): Promise<KBDocument[]> => {
      if (!effectiveUserId) return [];

      let query = (supabase as any).from('knowledge_base').select('*');

      if (targetUserId) {
        // Admin/manager viewing a specific client — pull all their docs
        query = query.eq('user_id', targetUserId);
      } else if (accountId) {
        // Active user: merge group docs + active location's docs (or filter by scope if passed)
        if (scope === 'group') {
          query = query.eq('account_id', accountId).eq('scope', 'group');
        } else if (scope === 'location' && activeLocationId) {
          query = query.eq('location_id', activeLocationId).eq('scope', 'location');
        } else if (activeLocationId) {
          query = query.eq('account_id', accountId)
            .or(`scope.eq.group,and(scope.eq.location,location_id.eq.${activeLocationId})`);
        } else {
          query = query.eq('account_id', accountId).eq('scope', 'group');
        }
      } else {
        return [];
      }

      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) throw error;

      const docs = (data || []) as KBDocument[];
      const docsWithSecureUrls = await Promise.all(
        docs.map(async (doc) => {
          const metadata = (doc.metadata || {}) as Record<string, unknown>;
          const storagePath = typeof metadata.storage_path === 'string' ? metadata.storage_path : null;
          if (!storagePath) return doc;
          const { data: signedData, error: signedError } = await supabase.storage
            .from('kb-files')
            .createSignedUrl(storagePath, KB_FILE_URL_TTL_SECONDS);
          if (signedError || !signedData?.signedUrl) return doc;
          return { ...doc, metadata: { ...metadata, file_url: signedData.signedUrl } };
        })
      );

      return docsWithSecureUrls;
    },
    enabled: !!effectiveUserId,
  });

  const addDocument = useMutation({
    mutationFn: async (doc: {
      title: string;
      doc_type: KBDocumentType;
      content: string;
      metadata?: Record<string, unknown>;
      scope?: KBScope;
    }) => {
      if (!effectiveUserId) throw new Error('Must be logged in');
      if (!accountId) throw new Error('No active workspace');
      const docScope = doc.scope || scope || 'location';
      const payload: any = {
        title: doc.title,
        doc_type: doc.doc_type,
        content: doc.content,
        metadata: doc.metadata,
        user_id: effectiveUserId,
        account_id: accountId,
        scope: docScope,
        location_id: docScope === 'location' ? activeLocationId : null,
      };
      if (docScope === 'location' && !activeLocationId) {
        throw new Error('No active location');
      }
      const { data, error } = await (supabase as any)
        .from('knowledge_base')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
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
