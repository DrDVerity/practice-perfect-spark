import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Hook to manage platform posting rules in the Knowledge Base.
 * 
 * Flow:
 * 1. Check client KB for platform rules
 * 2. If missing, check admin KB for platform rules
 * 3. If found in admin KB, copy to client KB
 * 4. If not found anywhere, generate via edge function and save to admin KB, then copy to client
 */
export const usePlatformRules = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPlatforms, setGeneratingPlatforms] = useState<Set<string>>(new Set());

  const ensurePlatformRules = useCallback(async (platform: string): Promise<string | null> => {
    if (!user) return null;

    try {
      setGeneratingPlatforms(prev => new Set(prev).add(platform));

      // 1. Check client KB
      const { data: clientDocs } = await (supabase as any)
        .from('knowledge_base')
        .select('id, content')
        .eq('user_id', user.id)
        .eq('doc_type', 'platform_rules')
        .ilike('title', `%${platform}%`)
        .limit(1);

      if (clientDocs && clientDocs.length > 0) {
        return clientDocs[0].content;
      }

      // 2. Check admin KB — find admin user_id first
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1);

      const adminUserId = adminRoles?.[0]?.user_id;

      if (adminUserId) {
        const { data: adminDocs } = await (supabase as any)
          .from('knowledge_base')
          .select('title, content, metadata')
          .eq('user_id', adminUserId)
          .eq('doc_type', 'platform_rules')
          .ilike('title', `%${platform}%`)
          .limit(1);

        if (adminDocs && adminDocs.length > 0) {
          // 3. Copy from admin KB to client KB
          const adminDoc = adminDocs[0];
          await (supabase as any)
            .from('knowledge_base')
            .insert({
              user_id: user.id,
              title: adminDoc.title,
              doc_type: 'platform_rules',
              content: adminDoc.content,
              metadata: { ...adminDoc.metadata, copied_from: 'admin_kb' },
            });

          queryClient.invalidateQueries({ queryKey: ['knowledge-base', user.id] });
          toast.success(`${platform} posting guidelines copied to your Knowledge Base`);
          return adminDoc.content;
        }
      }

      // 4. Not found anywhere — generate via edge function for admin KB first, then copy to client
      toast.info(`Generating ${platform} posting guidelines...`);
      
      // Generate for admin if admin exists
      if (adminUserId) {
        await supabase.functions.invoke('generate-platform-rules', {
          body: { platform: platform.toLowerCase(), userId: adminUserId },
        });
      }

      // Generate for client
      const { data, error } = await supabase.functions.invoke('generate-platform-rules', {
        body: { platform: platform.toLowerCase() },
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['knowledge-base', user.id] });
      if (adminUserId) {
        queryClient.invalidateQueries({ queryKey: ['admin-kb-docs'] });
      }

      toast.success(`${platform} posting guidelines generated!`);
      return data?.document?.content || null;
    } catch (err) {
      console.error(`Error ensuring platform rules for ${platform}:`, err);
      toast.error(`Failed to get posting guidelines for ${platform}`);
      return null;
    } finally {
      setGeneratingPlatforms(prev => {
        const next = new Set(prev);
        next.delete(platform);
        return next;
      });
    }
  }, [user, queryClient]);

  const generateAllPlatformRules = useCallback(async (targetUserId?: string) => {
    const platforms = ['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin', 'twitter'];
    setIsGenerating(true);

    try {
      let successCount = 0;
      for (const platform of platforms) {
        try {
          const { data, error } = await supabase.functions.invoke('generate-platform-rules', {
            body: { platform, userId: targetUserId },
          });
          if (error) throw error;
          if (data?.alreadyExists) {
            console.log(`${platform} rules already exist, skipping`);
          }
          successCount++;
        } catch (err) {
          console.error(`Failed to generate rules for ${platform}:`, err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      queryClient.invalidateQueries({ queryKey: ['admin-kb-docs'] });
      toast.success(`Generated posting guidelines for ${successCount}/${platforms.length} platforms`);
    } finally {
      setIsGenerating(false);
    }
  }, [queryClient]);

  return {
    ensurePlatformRules,
    generateAllPlatformRules,
    isGenerating,
    generatingPlatforms,
  };
};
