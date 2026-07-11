import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Hook to manage platform posting rules.
 *
 * Platform rules live ONLY in the Main administrative Knowledge Base.
 * Client KBs never store platform_rules documents.
 *
 * Flow:
 * 1. Look up the platform's rules in the admin KB.
 * 2. If missing, ask the edge function to generate them into the admin KB.
 * 3. Return the admin KB content for use by ad/post generators.
 */
export const usePlatformRules = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPlatforms, setGeneratingPlatforms] = useState<Set<string>>(new Set());

  const getAdminUserId = useCallback(async (): Promise<string | null> => {
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1);
    return adminRoles?.[0]?.user_id ?? null;
  }, []);

  const ensurePlatformRules = useCallback(async (platform: string): Promise<string | null> => {
    if (!user) return null;

    try {
      setGeneratingPlatforms(prev => new Set(prev).add(platform));

      const adminUserId = await getAdminUserId();
      if (!adminUserId) {
        console.warn('No admin user found, cannot resolve platform rules');
        return null;
      }

      // 1. Look in admin KB
      const { data: adminDocs } = await (supabase as any)
        .from('knowledge_base')
        .select('content')
        .eq('user_id', adminUserId)
        .eq('doc_type', 'platform_rules')
        .ilike('title', `%${platform}%`)
        .limit(1);

      if (adminDocs && adminDocs.length > 0) {
        return adminDocs[0].content;
      }

      // 2. Not found, generate into admin KB only
      const { data, error } = await supabase.functions.invoke('generate-platform-rules', {
        body: { platform: platform.toLowerCase(), userId: adminUserId },
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['admin-kb-docs'] });
      return data?.document?.content || null;
    } catch (err) {
      console.error(`Error ensuring platform rules for ${platform}:`, err);
      return null;
    } finally {
      setGeneratingPlatforms(prev => {
        const next = new Set(prev);
        next.delete(platform);
        return next;
      });
    }
  }, [user, queryClient, getAdminUserId]);

  const generateAllPlatformRules = useCallback(async (targetUserId?: string) => {
    const platforms = ['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin', 'twitter'];
    setIsGenerating(true);

    try {
      // Always target the admin KB; ignore targetUserId if it isn't an admin.
      const adminUserId = targetUserId || (await getAdminUserId());
      if (!adminUserId) {
        toast.error('No admin user found to store platform rules');
        return;
      }

      let successCount = 0;
      for (const platform of platforms) {
        try {
          const { error } = await supabase.functions.invoke('generate-platform-rules', {
            body: { platform, userId: adminUserId },
          });
          if (error) throw error;
          successCount++;
        } catch (err) {
          console.error(`Failed to generate rules for ${platform}:`, err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin-kb-docs'] });
      toast.success(`Generated posting guidelines for ${successCount}/${platforms.length} platforms`);
    } finally {
      setIsGenerating(false);
    }
  }, [queryClient, getAdminUserId]);

  return {
    ensurePlatformRules,
    generateAllPlatformRules,
    isGenerating,
    generatingPlatforms,
  };
};
