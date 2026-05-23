import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Users, Megaphone, ChevronDown, ChevronRight, CalendarDays, Plus, Pencil, Trash2, BookOpen, FileText, Search, Sparkles, Loader2, Shield, UserCheck, UserX, MoreHorizontal, Copy, AlertTriangle, Key, Cpu, MessageSquare, Image as ImageIcon, Video, Bot, Zap, FolderInput } from 'lucide-react';
import { usePlatformRules } from '@/hooks/usePlatformRules';
import EditClientDialog from '@/components/admin/EditClientDialog';
import CreateClientDialog from '@/components/admin/CreateClientDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDocTypeLabel, KBDocumentType } from '@/hooks/useKnowledgeBase';
import { format } from 'date-fns';
import { useBundleSocial } from '@/hooks/useBundleSocial';
import { ThemeToggle } from '@/components/ThemeToggle';

interface ProfileWithCampaigns {
  user_id: string;
  practice_name: string | null;
  email: string | null;
  deleted_at?: string | null;
  parent_account_id?: string | null;
  full_name?: string | null;
  bundle_social_team_id?: string | null;
}

interface CampaignWithProfile {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  user_id: string;
  practice_name?: string | null;
}

interface KBDoc {
  id: string;
  user_id: string;
  title: string;
  doc_type: KBDocumentType;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const docTypeColors: Record<string, string> = {
  platform_rules: 'bg-blue-500/20 text-blue-700',
  audience_analysis: 'bg-purple-500/20 text-purple-700',
  market_analysis: 'bg-green-500/20 text-green-700',
  competitive_landscape: 'bg-orange-500/20 text-orange-700',
  demographics: 'bg-pink-500/20 text-pink-700',
  brand_guidelines: 'bg-amber-500/20 text-amber-700',
  custom: 'bg-muted text-muted-foreground',
  system_prompt: 'bg-indigo-500/20 text-indigo-700',
};

const allDocTypes: KBDocumentType[] = [
  'platform_rules', 'audience_analysis', 'market_analysis',
  'competitive_landscape', 'demographics', 'brand_guidelines', 'system_prompt', 'custom',
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();
  const impersonateAndGoToDashboard = (clientUserId: string) => {
    startImpersonation(clientUserId);
    navigate('/dashboard');
  };
  const { isAdmin, isManager, managedClientIds, user, isLoading: authLoading, isRoleLoading } = useAuth();
  const [activeView, setActiveView] = useState<'overview' | 'accounts' | 'campaigns' | 'knowledge_base' | 'variances' | 'managers' | 'ai_models' | 'sub_accounts'>('overview');
  const [addSubForBusinessId, setAddSubForBusinessId] = useState<string | null>(null);
  const [subForm, setSubForm] = useState({ email: '', password: '', full_name: '' });
  const [creatingSub, setCreatingSub] = useState(false);
  const [modelAssignments, setModelAssignments] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('ai_model_assignments') || '{}'); } catch { return {}; }
  });
  const [editingModelKey, setEditingModelKey] = useState<string | null>(null);
  const [pendingModelId, setPendingModelId] = useState<string>('');

  // OpenRouter catalog — model IDs match OpenRouter's slug format and are sent
  // directly to https://openrouter.ai/api/v1/chat/completions
  const AVAILABLE_MODELS: Array<{ id: string; label: string; group: string }> = [
    // OpenAI
    { id: 'openai/gpt-5', label: 'GPT-5', group: 'OpenAI' },
    { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini', group: 'OpenAI' },
    { id: 'openai/gpt-5-nano', label: 'GPT-5 Nano', group: 'OpenAI' },
    { id: 'openai/gpt-4o', label: 'GPT-4o', group: 'OpenAI' },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', group: 'OpenAI' },
    { id: 'openai/o1', label: 'o1 (reasoning)', group: 'OpenAI' },
    { id: 'openai/o3-mini', label: 'o3 Mini (reasoning)', group: 'OpenAI' },
    // Anthropic
    { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', group: 'Anthropic' },
    { id: 'anthropic/claude-opus-4.1', label: 'Claude Opus 4.1', group: 'Anthropic' },
    { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet', group: 'Anthropic' },
    { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku', group: 'Anthropic' },
    // Google
    { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', group: 'Google' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', group: 'Google' },
    { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', group: 'Google' },
    { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', group: 'Google' },
    // Meta
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', group: 'Meta' },
    { id: 'meta-llama/llama-3.1-405b-instruct', label: 'Llama 3.1 405B Instruct', group: 'Meta' },
    // DeepSeek
    { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (reasoning)', group: 'DeepSeek' },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 Chat', group: 'DeepSeek' },
    // Mistral
    { id: 'mistralai/mistral-large-2411', label: 'Mistral Large', group: 'Mistral' },
    { id: 'mistralai/mixtral-8x22b-instruct', label: 'Mixtral 8x22B Instruct', group: 'Mistral' },
    // xAI
    { id: 'x-ai/grok-4', label: 'Grok 4', group: 'xAI' },
    { id: 'x-ai/grok-2-1212', label: 'Grok 2', group: 'xAI' },
    // Qwen
    { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B Instruct', group: 'Qwen' },
    // Image generation (OpenRouter modality: image)
    { id: 'google/gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image', group: 'Image' },
    { id: 'openai/gpt-4o-image', label: 'GPT-4o Image', group: 'Image' },
  ];

  const saveModelAssignment = (key: string, modelId: string) => {
    const next = { ...modelAssignments, [key]: modelId };
    setModelAssignments(next);
    localStorage.setItem('ai_model_assignments', JSON.stringify(next));
    setEditingModelKey(null);
    toast.success('Model assignment saved');
  };

  const resetModelAssignment = (key: string) => {
    const next = { ...modelAssignments };
    delete next[key];
    setModelAssignments(next);
    localStorage.setItem('ai_model_assignments', JSON.stringify(next));
    setEditingModelKey(null);
    toast.success('Reset to default');
  };
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateManagerDialog, setShowCreateManagerDialog] = useState(false);
  const [newManagerForm, setNewManagerForm] = useState({ email: '', password: '', practice_name: '' });
  const [creatingManager, setCreatingManager] = useState(false);
  const [kbSearch, setKbSearch] = useState('');
  const [kbFilterClient, setKbFilterClient] = useState<string>('all');
  const [editingKBDoc, setEditingKBDoc] = useState<KBDoc | null>(null);
  const [kbFormTitle, setKbFormTitle] = useState('');
  const [kbFormType, setKbFormType] = useState<KBDocumentType>('custom');
  const [kbFormContent, setKbFormContent] = useState('');
  const [assigningManagerId, setAssigningManagerId] = useState<string | null>(null);
  const [deletingManagerId, setDeletingManagerId] = useState<string | null>(null);
  const [reassignSelections, setReassignSelections] = useState<Record<string, string>>({});
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [movingKBDoc, setMovingKBDoc] = useState<KBDoc | null>(null);
  const [moveTargetUserId, setMoveTargetUserId] = useState<string>('');
  const [moveScope, setMoveScope] = useState<'group' | 'location'>('location');
  const [moveLocationId, setMoveLocationId] = useState<string>('');
  const [movingDoc, setMovingDoc] = useState(false);
  const [moveLocations, setMoveLocations] = useState<Array<{ id: string; name: string; is_default: boolean }>>([]);
  const queryClient = useQueryClient();
  const { generateAllPlatformRules, isGenerating: isGeneratingRules } = usePlatformRules();
  const { createTeam: bsCreateTeam, getConnectLink: bsGetConnectLink } = useBundleSocial();

  const handleProvisionBundleSocialTeam = async (userId: string) => {
    try {
      await bsCreateTeam.mutateAsync(userId);
      refetchProfiles();
      try {
        const { url } = await bsGetConnectLink.mutateAsync({ profileUserId: userId });
        window.open(url, '_blank', 'noopener,noreferrer');
        toast.success('Connect page opened in a new tab');
      } catch (linkErr: any) {
        toast.warning('Team provisioned, but connect page could not open', {
          description: linkErr.message,
        });
      }
    } catch {
      // toast already shown by hook
    }
  };

  // Fetch all profiles (admin only) — only active (non-deleted) accounts
  const { data: profiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, practice_name, email, deleted_at, parent_account_id, full_name, bundle_social_team_id')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProfileWithCampaigns[];
    },
    enabled: isAdmin || isManager,
  });

  // Fetch soft-deleted accounts (recoverable for 30 days)
  const { data: deletedProfiles = [], refetch: refetchDeletedProfiles } = useQuery({
    queryKey: ['admin-deleted-profiles'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('user_id, practice_name, email, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data as Array<ProfileWithCampaigns & { deleted_at: string }>;
    },
    enabled: isAdmin,
  });

  const handleRestoreAccount = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('admin-delete-account', {
      body: { user_id: userId, mode: 'restore' },
    });
    if (error || (data as any)?.error) {
      toast.error('Failed to restore', { description: error?.message || (data as any)?.error });
    } else {
      toast.success('Account restored');
      refetchProfiles();
      refetchDeletedProfiles();
    }
  };

  const handlePurgeAccount = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('admin-delete-account', {
      body: { user_id: userId, mode: 'purge' },
    });
    if (error || (data as any)?.error) {
      toast.error('Failed to permanently remove', { description: error?.message || (data as any)?.error });
    } else {
      toast.success('Account permanently removed');
      refetchDeletedProfiles();
    }
  };

  const handleCreateSubAccount = async () => {
    if (!addSubForBusinessId) return;
    if (!subForm.email || !subForm.password) {
      toast.error('Email and password are required');
      return;
    }
    setCreatingSub(true);
    const { data, error } = await supabase.functions.invoke('admin-create-sub-account', {
      body: {
        parent_user_id: addSubForBusinessId,
        email: subForm.email,
        password: subForm.password,
        full_name: subForm.full_name || null,
      },
    });
    setCreatingSub(false);
    if (error || (data as any)?.error) {
      toast.error('Failed to create sub-account', { description: error?.message || (data as any)?.error });
    } else {
      toast.success('Sub-account created');
      setAddSubForBusinessId(null);
      setSubForm({ email: '', password: '', full_name: '' });
      refetchProfiles();
    }
  };
  const { data: allCampaigns = [], refetch: refetchCampaigns } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name, status, start_date, end_date, user_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CampaignWithProfile[];
    },
    enabled: isAdmin || isManager,
  });

  // Fetch all KB docs (admin only)
  const { data: allKBDocs = [], refetch: refetchKBDocs } = useQuery({
    queryKey: ['admin-kb-docs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('knowledge_base')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as KBDoc[];
    },
    enabled: isAdmin || isManager,
  });

  // Fetch all user roles
  const { data: allRoles = [], refetch: refetchRoles } = useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || isManager,
  });

  // Fetch all manager assignments
  const { data: allAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['admin-manager-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manager_assignments')
        .select('*');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || isManager,
  });

  // Fetch all campaign addons (vectors) — used to surface variances
  const { data: allAddons = [] } = useQuery({
    queryKey: ['admin-campaign-addons'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('campaign_addons')
        .select('id, campaign_id, addon_type, custom_label');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin || isManager,
  });

  const getUserRoles = (userId: string) => allRoles.filter(r => r.user_id === userId).map(r => r.role);
  const isUserManager = (userId: string) => getUserRoles(userId).includes('manager');
  const isUserAdmin = (userId: string) => getUserRoles(userId).includes('admin');
  const getManagerAssignments = (managerId: string) => allAssignments.filter(a => a.manager_user_id === managerId);
  const getClientManagers = (clientId: string) => allAssignments.filter(a => a.client_user_id === clientId);

  const handlePromoteToManager = async (userId: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'manager' as any });
    if (error && !String(error.message || '').toLowerCase().includes('duplicate')) {
      toast.error('Failed to promote user');
      return;
    }
    // Remove 'user' role so they appear under Managers, not Members
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'user' as any);
    // Remove any assignments where they were a client
    await supabase.from('manager_assignments').delete().eq('client_user_id', userId);
    toast.success('User promoted to Manager');
    await Promise.all([refetchRoles(), refetchProfiles(), refetchAssignments()]);
  };

  const handleDemoteManager = async (userId: string) => {
    const assignments = allAssignments.filter(a => a.manager_user_id === userId);
    if (assignments.length > 0) {
      setDeletingManagerId(userId);
      return;
    }
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'manager' as any);
    if (error) { toast.error('Failed to demote user'); return; }
    toast.success('User demoted from Manager');
    refetchRoles();
    refetchAssignments();
  };

  const handleAssignClient = async (managerId: string, clientId: string) => {
    if (!user) return;
    const { error } = await supabase.from('manager_assignments').insert({
      manager_user_id: managerId,
      client_user_id: clientId,
      assigned_by: user.id,
    });
    if (error) { toast.error('Failed to assign client'); return; }
    toast.success('Client assigned to manager');
    refetchAssignments();
  };

  const handleUnassignClient = async (managerId: string, clientId: string) => {
    const { error } = await supabase.from('manager_assignments')
      .delete()
      .eq('manager_user_id', managerId)
      .eq('client_user_id', clientId);
    if (error) { toast.error('Failed to unassign client'); return; }
    toast.success('Client unassigned');
    refetchAssignments();
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId || !newPassword) return;
    setResettingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ user_id: resetPasswordUserId, new_password: newPassword }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to reset password');
      toast.success('Password reset successfully');
      setResetPasswordUserId(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCopyCampaign = async (campaign: CampaignWithProfile) => {
    const { error } = await supabase.from('campaigns').insert({
      name: `Copy of ${campaign.name}`,
      user_id: campaign.user_id,
      location_id: (campaign as any).location_id,
      status: 'developing' as any,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
    });
    if (error) { toast.error('Failed to copy campaign'); return; }
    toast.success('Campaign copied');
    refetchCampaigns();
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    // Delete channels and posts first
    const { data: channels } = await supabase.from('campaign_channels').select('id').eq('campaign_id', campaignId);
    if (channels && channels.length > 0) {
      const channelIds = channels.map(c => c.id);
      await supabase.from('channel_posts').delete().in('campaign_channel_id', channelIds);
      await supabase.from('campaign_channels').delete().eq('campaign_id', campaignId);
    }
    const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (error) { toast.error('Failed to delete campaign'); return; }
    toast.success('Campaign deleted');
    setDeletingCampaignId(null);
    refetchCampaigns();
  };

  if (authLoading || (user && isRoleLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin && !isManager) {
    navigate('/dashboard');
    return null;
  }

  // For managers, filter data to only their assigned clients
  const visibleProfiles = isAdmin ? profiles : profiles.filter(p => managedClientIds.includes(p.user_id));
  const visibleCampaigns = isAdmin ? allCampaigns : allCampaigns.filter(c => managedClientIds.includes(c.user_id));
  
  // Admin KB: show only the admin's own docs
  const adminKBDocs = user ? allKBDocs.filter(d => d.user_id === user.id) : [];
  const visibleKBDocs = isAdmin ? allKBDocs : allKBDocs.filter(d => managedClientIds.includes(d.user_id));

  // Variances computation
  const managerProfiles = profiles.filter(p => isUserManager(p.user_id));
  const clientProfiles = profiles.filter(p => !isUserAdmin(p.user_id) && !isUserManager(p.user_id));
  const assignableClientProfiles = clientProfiles.filter(p => p.user_id !== assigningManagerId);
  const unassignedClients = clientProfiles.filter(p => !allAssignments.some(a => a.client_user_id === p.user_id));
  const membersWithoutPractice = profiles.filter(p => !p.practice_name && !isUserAdmin(p.user_id) && !isUserManager(p.user_id));
  const orphanedCampaigns = allCampaigns.filter(c => !profiles.some(p => p.user_id === c.user_id));
  const totalVariances = unassignedClients.length + membersWithoutPractice.length + orphanedCampaigns.length;

  const handleCreateManager = async () => {
    if (!newManagerForm.email.trim() || !newManagerForm.password.trim()) {
      toast.error('Email and password are required');
      return;
    }
    setCreatingManager(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-manager`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: newManagerForm.email,
            password: newManagerForm.password,
            practice_name: newManagerForm.practice_name || null,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create manager');
      toast.success('Manager account created');
      setShowCreateManagerDialog(false);
      setNewManagerForm({ email: '', password: '', practice_name: '' });
      refetchProfiles();
      refetchRoles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create manager');
    } finally {
      setCreatingManager(false);
    }
  };

  // Group campaigns by user_id
  const campaignsByUser = visibleCampaigns.reduce((acc, campaign) => {
    if (!acc[campaign.user_id]) acc[campaign.user_id] = [];
    acc[campaign.user_id].push(campaign);
    return acc;
  }, {} as Record<string, CampaignWithProfile[]>);

  const toggleAccount = (userId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const getProfileName = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return getDisplayName(p);
  };

  const getDisplayName = (profile?: ProfileWithCampaigns | null) => {
    if (!profile) return 'Unknown Account';
    if (profile.practice_name?.trim()) return profile.practice_name;
    const emailName = profile.email?.split('@')[0]?.trim();
    return emailName ? emailName.charAt(0).toUpperCase() + emailName.slice(1) : 'Unknown Account';
  };

  // KB helpers
  const filteredKBDocs = visibleKBDocs.filter(doc => {
    const matchesSearch = !kbSearch ||
      doc.title.toLowerCase().includes(kbSearch.toLowerCase()) ||
      doc.content.toLowerCase().includes(kbSearch.toLowerCase());
    const matchesClient = kbFilterClient === 'all' || doc.user_id === kbFilterClient;
    return matchesSearch && matchesClient;
  });

  const kbDocsByClient = filteredKBDocs.reduce((acc, doc) => {
    if (!acc[doc.user_id]) acc[doc.user_id] = [];
    acc[doc.user_id].push(doc);
    return acc;
  }, {} as Record<string, KBDoc[]>);

  const openEditKBDoc = (doc: KBDoc) => {
    setEditingKBDoc(doc);
    setKbFormTitle(doc.title);
    setKbFormType(doc.doc_type);
    setKbFormContent(doc.content);
  };

  const handleSaveKBDoc = async () => {
    if (!editingKBDoc) return;
    const { error } = await (supabase as any)
      .from('knowledge_base')
      .update({ title: kbFormTitle, doc_type: kbFormType, content: kbFormContent })
      .eq('id', editingKBDoc.id);
    if (error) { toast.error('Failed to update document'); return; }
    toast.success('Document updated');
    setEditingKBDoc(null);
    refetchKBDocs();
  };

  const handleDeleteKBDoc = async (id: string) => {
    const { error } = await (supabase as any)
      .from('knowledge_base')
      .delete()
      .eq('id', id);
    if (error) { toast.error('Failed to delete document'); return; }
    toast.success('Document deleted');
    refetchKBDocs();
  };

  const openMoveKBDoc = async (doc: KBDoc) => {
    setMovingKBDoc(doc);
    setMoveTargetUserId('');
    setMoveScope('location');
    setMoveLocationId('');
    setMoveLocations([]);
  };

  const loadLocationsForTarget = async (userId: string) => {
    setMoveTargetUserId(userId);
    setMoveLocationId('');
    setMoveLocations([]);
    if (!userId) return;
    const { data: prof } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!prof?.account_id) return;
    const { data: locs } = await supabase
      .from('locations')
      .select('id, name, is_default')
      .eq('account_id', prof.account_id)
      .order('is_default', { ascending: false });
    setMoveLocations((locs as any) || []);
    const def = (locs || []).find((l: any) => l.is_default) || (locs || [])[0];
    if (def) setMoveLocationId((def as any).id);
  };

  const handleMoveKBDoc = async () => {
    if (!movingKBDoc || !moveTargetUserId) return;
    setMovingDoc(true);
    try {
      const { data, error } = await supabase.functions.invoke('kb-move-document', {
        body: {
          docId: movingKBDoc.id,
          targetUserId: moveTargetUserId,
          scope: moveScope,
          locationId: moveScope === 'location' ? moveLocationId || null : null,
        },
      });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
      toast.success('Document moved');
      setMovingKBDoc(null);
      refetchKBDocs();
    } catch (e: any) {
      toast.error('Failed to move document', { description: e?.message });
    } finally {
      setMovingDoc(false);
    }
  };

  const handleDeleteClient = async (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const { data, error } = await supabase.functions.invoke('admin-delete-account', {
      body: { user_id: userId },
    });
    if (error || (data as any)?.error) {
      toast.error('Failed to delete account', { description: error?.message || (data as any)?.error });
      return;
    }
    toast.success('Account moved to recovery (30 days)');
    queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['admin-deleted-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo />
            <Badge className="bg-primary text-primary-foreground">{isAdmin ? 'Admin' : 'Manager'}</Badge>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container px-4 py-8 md:py-12">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-8">{isAdmin ? 'Admin' : 'Manager'} Dashboard</h1>

        {activeView === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-6xl">
            {/* Tile 1: All Practices */}
            <Card
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
              onClick={() => setActiveView('accounts')}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">All Practices/Accounts</p>
                  <p className="text-3xl font-bold text-foreground">{visibleProfiles.length}</p>
                  <p className="text-xs text-primary mt-1">Click to view</p>
                </div>
              </CardContent>
            </Card>

            {/* Tile 2: All Campaigns */}
            <Card
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
              onClick={() => setActiveView('campaigns')}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Megaphone className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">All Campaigns</p>
                  <p className="text-3xl font-bold text-foreground">{visibleCampaigns.length}</p>
                  <p className="text-xs text-primary mt-1">Click to view</p>
                </div>
              </CardContent>
            </Card>

            {/* Tile 3: Knowledge Base (admin's own docs) */}
            <Card
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
              onClick={() => setActiveView('knowledge_base')}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Admin Knowledge Base</p>
                  <p className="text-3xl font-bold text-foreground">{adminKBDocs.length}</p>
                  <p className="text-xs text-primary mt-1">Click to manage</p>
                </div>
              </CardContent>
            </Card>

            {/* Tile 4: Managers */}
            {isAdmin && (
              <Card
                className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
                onClick={() => setActiveView('managers')}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <UserCheck className="w-7 h-7 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Managers</p>
                    <p className="text-3xl font-bold text-foreground">{managerProfiles.length}</p>
                    <p className="text-xs text-primary mt-1">Click to manage</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tile 5: Variances */}
            {isAdmin && (
              <Card
                className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
                onClick={() => setActiveView('variances')}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${totalVariances > 0 ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                    <AlertTriangle className={`w-7 h-7 ${totalVariances > 0 ? 'text-destructive' : 'text-green-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Variances</p>
                    <p className="text-3xl font-bold text-foreground">{totalVariances}</p>
                    <p className="text-xs text-primary mt-1">{totalVariances > 0 ? 'Issues to resolve' : 'All clear'}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tile 6: AI Models */}
            <Card
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
              onClick={() => setActiveView('ai_models')}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Cpu className="w-7 h-7 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">AI Models</p>
                  <p className="text-3xl font-bold text-foreground">{6}</p>
                  <p className="text-xs text-primary mt-1">View active models</p>
                </div>
              </CardContent>
            </Card>

            {/* Tile 7: Accounts & Sub-Accounts */}
            {isAdmin && (
              <Card
                className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
                onClick={() => setActiveView('sub_accounts')}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-teal-500/10 flex items-center justify-center">
                    <Users className="w-7 h-7 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Accounts & Sub-Accounts</p>
                    <p className="text-3xl font-bold text-foreground">
                      {profiles.filter(p => !isUserAdmin(p.user_id) && !isUserManager(p.user_id)).length}
                    </p>
                    <p className="text-xs text-primary mt-1">Click to view</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* SUB-ACCOUNTS VIEW */}
        {activeView === 'sub_accounts' && isAdmin && (() => {
          const clientAccounts = profiles.filter(p => !isUserAdmin(p.user_id) && !isUserManager(p.user_id));
          const businesses = clientAccounts.filter(p => !p.parent_account_id);
          const subsByParent: Record<string, ProfileWithCampaigns[]> = {};
          for (const p of clientAccounts) {
            if (p.parent_account_id) {
              (subsByParent[p.parent_account_id] ||= []).push(p);
            }
          }
          return (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="sm" onClick={() => setActiveView('overview')}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <h2 className="text-xl font-semibold text-foreground">All Accounts & Sub-Accounts</h2>
                <Badge variant="secondary">{businesses.length} businesses</Badge>
                <Badge variant="outline">{clientAccounts.length - businesses.length} sub-accounts</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Every client business account and the individual users attached to it. Administrators and managers are not included.
              </p>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Individual Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businesses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          No client accounts yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {businesses.map((biz) => {
                      const subs = subsByParent[biz.user_id] || [];
                      return (
                        <React.Fragment key={biz.user_id}>
                          <TableRow className="bg-muted/30 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/account/${biz.user_id}`)}>
                            <TableCell className="font-semibold">{biz.practice_name || 'Unnamed Business'}</TableCell>
                            <TableCell>{biz.full_name || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{biz.email || '—'}</TableCell>
                            <TableCell><Badge variant="secondary">Owner</Badge></TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setAddSubForBusinessId(biz.user_id); setSubForm({ email: '', password: '', full_name: '' }); }}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Add sub-account
                              </Button>
                            </TableCell>
                          </TableRow>
                          {subs.map((s) => (
                            <TableRow key={s.user_id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/admin/account/${biz.user_id}`)}>
                              <TableCell className="pl-10 text-muted-foreground">↳ {biz.practice_name || ''}</TableCell>
                              <TableCell>{s.full_name || '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{s.email || '—'}</TableCell>
                              <TableCell><Badge variant="outline">Sub-account</Badge></TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                            </TableRow>
                          ))}
                          {subs.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="pl-10 text-xs text-muted-foreground italic">
                                No sub-accounts attached.
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })()}

        {/* Add Sub-Account Dialog */}
        <Dialog open={!!addSubForBusinessId} onOpenChange={(v) => !v && setAddSubForBusinessId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add sub-account</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="sub-name">Full Name</Label>
                <Input
                  id="sub-name"
                  value={subForm.full_name}
                  onChange={(e) => setSubForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <Label htmlFor="sub-email">Email</Label>
                <Input
                  id="sub-email"
                  type="email"
                  value={subForm.email}
                  onChange={(e) => setSubForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <Label htmlFor="sub-password">Temporary Password</Label>
                <Input
                  id="sub-password"
                  type="text"
                  value={subForm.password}
                  onChange={(e) => setSubForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddSubForBusinessId(null)}>Cancel</Button>
                <Button onClick={handleCreateSubAccount} disabled={creatingSub}>
                  {creatingSub ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>


        {/* AI MODELS VIEW */}
        {activeView === 'ai_models' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setActiveView('overview')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <h2 className="text-xl font-semibold text-foreground">AI Models in Use</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-3xl">
              The models powering each agent and workflow across the platform. All AI calls are routed through{' '}
              <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-primary underline">OpenRouter</a>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
              {[
                {
                  icon: MessageSquare,
                  color: 'text-blue-600 bg-blue-500/10',
                  name: 'General AI Chatbot',
                  model: 'Gemini 2.5 Flash',
                  id: 'google/gemini-2.5-flash',
                  desc: 'Default conversational model for in-app chat and quick Q&A.',
                },
                {
                  icon: Bot,
                  color: 'text-purple-600 bg-purple-500/10',
                  name: 'Marketing / Campaign Agent',
                  model: 'Claude Sonnet 4.5',
                  id: 'anthropic/claude-sonnet-4.5',
                  desc: 'Generates campaign strategies, gap analysis, and research synthesis.',
                },
                {
                  icon: Sparkles,
                  color: 'text-amber-600 bg-amber-500/10',
                  name: 'Content & Post Generation',
                  model: 'GPT-5 Mini',
                  id: 'openai/gpt-5-mini',
                  desc: 'Writes platform-specific social posts, captions, and CTAs.',
                },
                {
                  icon: ImageIcon,
                  color: 'text-pink-600 bg-pink-500/10',
                  name: 'Image Generation',
                  model: 'Gemini 2.5 Flash Image',
                  id: 'google/gemini-2.5-flash-image-preview',
                  desc: 'Creates and regenerates post images and visual assets.',
                },
                {
                  icon: Zap,
                  color: 'text-emerald-600 bg-emerald-500/10',
                  name: 'Research & Web Search',
                  model: 'Firecrawl Search v2',
                  id: 'firecrawl/v2',
                  desc: 'Live web research used by the Campaign Agent for gap-fill data (not routed via OpenRouter).',
                },
                {
                  icon: Video,
                  color: 'text-red-600 bg-red-500/10',
                  name: 'Video Generation',
                  model: 'Fal AI / HeyGen',
                  id: 'video/fal-heygen',
                  desc: 'Generates short marketing videos for social posts (not routed via OpenRouter).',
                },
              ].map((m) => {
                const Icon = m.icon;
                const override = modelAssignments[m.name];
                const activeId = override || m.id;
                const activeLabel = override
                  ? (AVAILABLE_MODELS.find(x => x.id === override)?.label || override)
                  : m.model;
                return (
                  <Card
                    key={m.name}
                    className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                    onClick={() => { setEditingModelKey(m.name); setPendingModelId(activeId); }}
                  >
                    <CardContent className="p-5 flex gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-foreground">{m.name}</h3>
                          {override && <Badge variant="secondary" className="text-xs">Overridden</Badge>}
                        </div>
                        <p className="text-sm font-medium text-primary mt-0.5">{activeLabel}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1 break-all">{activeId}</p>
                        <p className="text-sm text-muted-foreground mt-2">{m.desc}</p>
                        <p className="text-xs text-primary mt-2">
                          Click to change model →{' '}
                          <a
                            href="https://openrouter.ai/models"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            browse OpenRouter
                          </a>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Dialog open={!!editingModelKey} onOpenChange={(o) => !o && setEditingModelKey(null)}>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Assign model — {editingModelKey}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <Label>Model</Label>
                  <Select value={AVAILABLE_MODELS.some(m => m.id === pendingModelId) ? pendingModelId : ''} onValueChange={setPendingModelId}>
                    <SelectTrigger><SelectValue placeholder="Select from catalog…" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {AVAILABLE_MODELS.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label} <span className="text-xs text-muted-foreground ml-2">({opt.group})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="space-y-2">
                    <Label>Or enter a specific OpenRouter model ID</Label>
                    <Input
                      placeholder="e.g. anthropic/claude-3.5-sonnet"
                      value={pendingModelId}
                      onChange={(e) => setPendingModelId(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Use the exact slug from{' '}
                      <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-primary underline">openrouter.ai/models</a>.
                      Overrides this agent's default and is sent via the <code>x-model-override</code> header.
                    </p>
                  </div>
                  <div className="flex justify-between gap-2 pt-2">
                    <Button variant="outline" onClick={() => editingModelKey && resetModelAssignment(editingModelKey)}>
                      Reset to default
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditingModelKey(null)}>Cancel</Button>
                      <Button
                        disabled={!pendingModelId.trim()}
                        onClick={() => editingModelKey && saveModelAssignment(editingModelKey, pendingModelId.trim())}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* MANAGERS VIEW */}
        {activeView === 'managers' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setActiveView('overview')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <h2 className="text-xl font-semibold text-foreground">Managers</h2>
              <Badge variant="secondary">{managerProfiles.length}</Badge>
              <div className="ml-auto">
                <Button size="sm" onClick={() => setShowCreateManagerDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manager
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Assigned Clients</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managerProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No managers yet. Click "Add Manager" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    managerProfiles.map((mgr) => {
                      const assignments = getManagerAssignments(mgr.user_id);
                        return (
                        <TableRow
                          key={mgr.user_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/admin/account/${mgr.user_id}`)}
                        >
                          <TableCell className="font-medium">{getDisplayName(mgr)}</TableCell>
                          <TableCell className="text-muted-foreground">{mgr.email || '—'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {assignments.length === 0 ? (
                                <span className="text-xs text-muted-foreground">None assigned</span>
                              ) : (
                                assignments.map(a => (
                                  <Badge key={a.id} variant="secondary" className="text-xs">
                                    {getProfileName(a.client_user_id)}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Manage Assignments"
                                onClick={() => setAssigningManagerId(mgr.user_id)}
                              >
                                <Users className="w-4 h-4 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Reset Password"
                                onClick={() => setResetPasswordUserId(mgr.user_id)}
                              >
                                <Key className="w-4 h-4 text-amber-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Remove Manager Role"
                                onClick={() => handleDemoteManager(mgr.user_id)}
                              >
                                <UserX className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* VARIANCES VIEW */}
        {activeView === 'variances' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setActiveView('overview')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <h2 className="text-xl font-semibold text-foreground">Variances</h2>
              <Badge variant="secondary">{totalVariances} issues</Badge>
            </div>

            {totalVariances === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="text-muted-foreground">No variances found — everything looks good!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Clients not assigned to a manager */}
                {unassignedClients.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserX className="w-4 h-4 text-destructive" />
                        Clients Not Assigned to a Manager ({unassignedClients.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {unassignedClients.map(p => (
                          <div key={p.user_id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                            <div>
                              <p className="font-medium text-sm">{p.practice_name || 'Unnamed'}</p>
                              <p className="text-xs text-muted-foreground">{p.email || '—'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePromoteToManager(p.user_id)}
                                >
                                  <Shield className="w-3 h-3 mr-1" /> Promote to Manager
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <UserCheck className="w-3 h-3 mr-1" /> Assign
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  {profiles
                                    .filter(mp => isUserManager(mp.user_id) || isUserAdmin(mp.user_id))
                                    .map(mp => (
                                      <DropdownMenuItem
                                        key={mp.user_id}
                                        onClick={() => handleAssignClient(mp.user_id, p.user_id)}
                                      >
                                        {mp.practice_name || mp.email || 'Unknown'} {isUserAdmin(mp.user_id) ? '(Admin)' : '(Manager)'}
                                      </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Members without practice */}
                {membersWithoutPractice.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-4 h-4 text-destructive" />
                        Members Without a Practice ({membersWithoutPractice.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {membersWithoutPractice.map(p => (
                          <div key={p.user_id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                            <div>
                              <p className="font-medium text-sm">{p.email || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">No practice assigned</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isAdmin && (
                                <Button variant="outline" size="sm" onClick={() => handlePromoteToManager(p.user_id)}>
                                  <Shield className="w-3 h-3 mr-1" /> Promote to Manager
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => setEditClientId(p.user_id)}>
                                <Pencil className="w-3 h-3 mr-1" /> Edit
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Campaigns not attached to a client account */}
                {orphanedCampaigns.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-destructive" />
                        Campaigns Not Attached to an Account ({orphanedCampaigns.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {orphanedCampaigns.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                            <div>
                              <p className="font-medium text-sm">{c.name}</p>
                              <p className="text-xs text-muted-foreground">Status: {c.status} · User ID: {c.user_id.slice(0, 8)}…</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <UserCheck className="w-3 h-3 mr-1" /> Assign to Account
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {profiles.map(p => (
                                  <DropdownMenuItem
                                    key={p.user_id}
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from('campaigns')
                                        .update({ user_id: p.user_id })
                                        .eq('id', c.id);
                                      if (error) { toast.error('Failed to reassign campaign'); return; }
                                      toast.success(`Campaign assigned to ${p.practice_name || p.email}`);
                                      refetchCampaigns();
                                    }}
                                  >
                                    {p.practice_name || p.email || 'Unknown'}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {activeView === 'accounts' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setActiveView('overview')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <h2 className="text-xl font-semibold text-foreground">All Practices/Accounts</h2>
              <Badge variant="secondary">{visibleProfiles.length}</Badge>
              <div className="ml-auto">
                <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Account
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Campaigns</TableHead>
                    <TableHead className="w-44">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleProfiles.map((profile) => {
                    const userCampaigns = campaignsByUser[profile.user_id] || [];
                    const roles = getUserRoles(profile.user_id);
                    const hasManager = isUserManager(profile.user_id);
                    const hasAdmin = isUserAdmin(profile.user_id);
                    const assignments = getManagerAssignments(profile.user_id);
                    return (
                      <React.Fragment key={profile.user_id}>
                         <TableRow
                           className="cursor-pointer hover:bg-accent/50"
                           onClick={() => impersonateAndGoToDashboard(profile.user_id)}
                         >
                           <TableCell className="font-medium">
                             {profile.practice_name || 'Unnamed'}
                           </TableCell>
                           <TableCell className="text-muted-foreground">
                             {profile.email || '—'}
                           </TableCell>
                           <TableCell>
                             <div className="flex gap-1 flex-wrap">
                               {hasAdmin && <Badge className="bg-primary text-primary-foreground"><Shield className="w-3 h-3 mr-1" />Admin</Badge>}
                               {hasManager && <Badge variant="outline" className="border-primary text-primary"><UserCheck className="w-3 h-3 mr-1" />Manager</Badge>}
                               {!hasAdmin && !hasManager && <Badge variant="secondary">User</Badge>}
                               {hasManager && assignments.length > 0 && (
                                 <Badge variant="secondary" className="text-xs">{assignments.length} assigned</Badge>
                               )}
                             </div>
                           </TableCell>
                           <TableCell>
                              <Badge variant="secondary">{userCampaigns.length}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {!hasAdmin && !hasManager && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Promote to Manager"
                                    onClick={(e) => { e.stopPropagation(); handlePromoteToManager(profile.user_id); }}
                                  >
                                    <UserCheck className="w-4 h-4 text-primary" />
                                  </Button>
                                )}
                                {hasManager && !hasAdmin && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="Manage Assignments"
                                      onClick={(e) => { e.stopPropagation(); setAssigningManagerId(profile.user_id); }}
                                    >
                                      <Users className="w-4 h-4 text-primary" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="Demote from Manager"
                                      onClick={(e) => { e.stopPropagation(); handleDemoteManager(profile.user_id); }}
                                    >
                                      <UserX className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); setEditClientId(profile.user_id); }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                {!hasAdmin && !hasManager && !profile.bundle_social_team_id && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Provision Bundle.social team"
                                    disabled={bsCreateTeam.isPending || bsGetConnectLink.isPending}
                                    onClick={(e) => { e.stopPropagation(); handleProvisionBundleSocialTeam(profile.user_id); }}
                                  >
                                    {bsCreateTeam.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                                    ) : (
                                      <Zap className="w-4 h-4 text-amber-600" />
                                    )}
                                  </Button>
                                )}
                                {!hasAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Reset Password"
                                    onClick={(e) => { e.stopPropagation(); setResetPasswordUserId(profile.user_id); }}
                                  >
                                    <Key className="w-4 h-4 text-amber-600" />
                                  </Button>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {profile.practice_name || 'This client'}'s account will be moved to a recoverable state and the user will be unable to sign in. You have 30 days to restore it before it's permanently removed.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={(e) => handleDeleteClient(profile.user_id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {isAdmin && (
              <div className="mt-10">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-foreground">Recently Deleted Accounts</h3>
                  <Badge variant="secondary">{deletedProfiles.length}</Badge>
                  <span className="text-xs text-muted-foreground">Recoverable for 30 days, then permanently removed.</span>
                </div>
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Practice</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Deleted</TableHead>
                        <TableHead>Days Left</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedProfiles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                            No deleted accounts.
                          </TableCell>
                        </TableRow>
                      )}
                      {deletedProfiles.map((p) => {
                        const deletedAt = p.deleted_at ? new Date(p.deleted_at) : null;
                        const daysSince = deletedAt ? Math.floor((Date.now() - deletedAt.getTime()) / 86400000) : 0;
                        const daysLeft = Math.max(0, 30 - daysSince);
                        return (
                          <TableRow key={p.user_id}>
                            <TableCell className="font-medium">{p.practice_name || 'Unnamed'}</TableCell>
                            <TableCell className="text-muted-foreground">{p.email || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {deletedAt ? format(deletedAt, 'MMM d, yyyy') : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={daysLeft <= 7 ? 'destructive' : 'secondary'}>{daysLeft} days</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="mr-2"
                                onClick={() => handleRestoreAccount(p.user_id)}
                              >
                                Restore
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">Remove now</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Permanently remove this account?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will immediately and permanently delete {p.practice_name || p.email || 'this account'} and all associated data. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handlePurgeAccount(p.user_id)}
                                    >
                                      Permanently delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'campaigns' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setActiveView('overview')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <h2 className="text-xl font-semibold text-foreground">All Campaigns</h2>
              <Badge variant="secondary">{visibleCampaigns.length}</Badge>
            </div>
            <div className="space-y-2">
              {Object.entries(campaignsByUser).map(([userId, campaigns]) => (
                <Collapsible
                  key={userId}
                  open={expandedAccounts.has(userId)}
                  onOpenChange={() => toggleAccount(userId)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
                      <div className="flex items-center gap-3">
                        {expandedAccounts.has(userId) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-foreground">{getProfileName(userId)}</span>
                        <Badge variant="secondary">{campaigns.length} campaigns</Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mt-1 rounded-xl border border-border bg-card overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Schedule</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campaigns.map((campaign) => (
                            <TableRow
                              key={campaign.id}
                              className="cursor-pointer hover:bg-accent/50"
                              onClick={() => navigate(`/campaign/${campaign.id}`)}
                            >
                              <TableCell className="font-medium">{campaign.name}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={
                                    campaign.status === 'active'
                                      ? 'bg-green-500/20 text-green-600'
                                      : campaign.status === 'developing'
                                      ? 'bg-amber-500/20 text-amber-600'
                                      : ''
                                  }
                                >
                                  {campaign.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/schedule');
                                  }}
                                >
                                  <CalendarDays className="w-4 h-4" />
                                </Button>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/campaign/${campaign.id}`); }}>
                                      <Pencil className="w-4 h-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyCampaign(campaign); }}>
                                      <Copy className="w-4 h-4 mr-2" /> Copy
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={(e) => { e.stopPropagation(); setDeletingCampaignId(campaign.id); }}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        )}
        {activeView === 'knowledge_base' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setActiveView('overview')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <h2 className="text-xl font-semibold text-foreground">Knowledge Base — All Clients</h2>
              <Badge variant="secondary">{visibleKBDocs.length} docs</Badge>
              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1);
                    const adminUserId = adminRoles?.[0]?.user_id;
                    if (adminUserId) {
                      await generateAllPlatformRules(adminUserId);
                      refetchKBDocs();
                    } else {
                      toast.error('Admin user not found');
                    }
                  }}
                  disabled={isGeneratingRules}
                  className="gap-2"
                >
                  {isGeneratingRules ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isGeneratingRules ? 'Generating...' : 'Generate All Platform Rules'}
                </Button>
              </div>
            </div>

            {/* Search & filter */}
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={kbSearch}
                  onChange={(e) => setKbSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={kbFilterClient} onValueChange={setKbFilterClient}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {visibleProfiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.practice_name || p.email || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Docs grouped by client */}
            {Object.entries(kbDocsByClient).length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No documents found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(kbDocsByClient).map(([userId, docs]) => (
                  <Collapsible
                    key={userId}
                    open={expandedAccounts.has(userId)}
                    onOpenChange={() => toggleAccount(userId)}
                    defaultOpen
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
                        <div className="flex items-center gap-3">
                          {expandedAccounts.has(userId) ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-medium text-foreground">{getProfileName(userId)}</span>
                          <Badge variant="secondary">{docs.length} docs</Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-8 mt-1 rounded-xl border border-border bg-card overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Title</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Updated</TableHead>
                              <TableHead className="w-24">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {docs.map(doc => (
                              <TableRow
                                key={doc.id}
                                className="cursor-pointer hover:bg-accent/50"
                                onClick={() => openEditKBDoc(doc)}
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary shrink-0" />
                                    {doc.title}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={docTypeColors[doc.doc_type] || ''}>
                                    {getDocTypeLabel(doc.doc_type)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {format(new Date(doc.updated_at), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEditKBDoc(doc); }}>
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Move to another KB" onClick={(e) => { e.stopPropagation(); openMoveKBDoc(doc); }}>
                                      <FolderInput className="w-4 h-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                                          <AlertDialogDescription>This will permanently delete "{doc.title}".</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteKBDoc(doc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* KB Edit Dialog */}
      <Dialog open={!!editingKBDoc} onOpenChange={(open) => { if (!open) setEditingKBDoc(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Edit Document — {editingKBDoc ? getProfileName(editingKBDoc.user_id) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={kbFormTitle} onChange={(e) => setKbFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={kbFormType} onValueChange={(v) => setKbFormType(v as KBDocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allDocTypes.map(type => (
                    <SelectItem key={type} value={type}>{getDocTypeLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={kbFormContent} onChange={(e) => setKbFormContent(e.target.value)} className="min-h-[250px]" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditingKBDoc(null)}>Cancel</Button>
              <Button onClick={handleSaveKBDoc}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUserId} onOpenChange={(open) => { if (!open) { setResetPasswordUserId(null); setNewPassword(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-600" />
              Reset Password — {resetPasswordUserId ? getProfileName(resetPasswordUserId) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                minLength={6}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setResetPasswordUserId(null); setNewPassword(''); }}>Cancel</Button>
              <Button onClick={handleResetPassword} disabled={resettingPassword || newPassword.length < 6}>
                {resettingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Campaign Confirmation */}
      <AlertDialog open={!!deletingCampaignId} onOpenChange={(open) => { if (!open) setDeletingCampaignId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the campaign and all its channels and posts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCampaignId && handleDeleteCampaign(deletingCampaignId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditClientDialog
        open={!!editClientId}
        onClose={() => setEditClientId(null)}
        clientId={editClientId || ''}
        onDeleted={() => setEditClientId(null)}
      />

      <CreateClientDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {/* Manager Assignment Dialog - admin can also assign to self */}
      <Dialog open={!!assigningManagerId} onOpenChange={(open) => { if (!open) setAssigningManagerId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Manage Client Assignments
            </DialogTitle>
          </DialogHeader>
          {assigningManagerId && (
            <div className="space-y-4">
              {(() => {
                const selectedManager = profiles.find(p => p.user_id === assigningManagerId);
                return selectedManager ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Selected manager</p>
                    <p className="font-semibold text-foreground">{getDisplayName(selectedManager)}</p>
                    <p className="text-xs text-muted-foreground">{selectedManager.email || '—'}</p>
                  </div>
                ) : null;
              })()}
              <p className="text-sm text-muted-foreground">
                Assign or unassign client accounts for <strong>{getProfileName(assigningManagerId)}</strong>.
              </p>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {assignableClientProfiles.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No client accounts are available to assign.
                  </div>
                ) : (
                  assignableClientProfiles.map(client => {
                    const isAssigned = allAssignments.some(
                      a => a.manager_user_id === assigningManagerId && a.client_user_id === client.user_id
                    );
                    return (
                      <div key={client.user_id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div>
                          <p className="font-medium text-sm">{getDisplayName(client)}</p>
                          <p className="text-xs text-muted-foreground">{client.email || '—'}</p>
                        </div>
                        {isAssigned ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleUnassignClient(assigningManagerId!, client.user_id)}
                          >
                            <UserX className="w-3 h-3 mr-1" /> Unassign
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignClient(assigningManagerId!, client.user_id)}
                          >
                            <UserCheck className="w-3 h-3 mr-1" /> Assign
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setAssigningManagerId(null)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Manager Dialog */}
      <Dialog open={showCreateManagerDialog} onOpenChange={(open) => { if (!open) setShowCreateManagerDialog(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              Create New Manager
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mgr-email">Email *</Label>
              <Input
                id="mgr-email"
                type="email"
                value={newManagerForm.email}
                onChange={(e) => setNewManagerForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="manager@example.com"
              />
            </div>
            <div>
              <Label htmlFor="mgr-password">Password *</Label>
              <Input
                id="mgr-password"
                type="password"
                value={newManagerForm.password}
                onChange={(e) => setNewManagerForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div>
              <Label htmlFor="mgr-name">Display Name</Label>
              <Input
                id="mgr-name"
                value={newManagerForm.practice_name}
                onChange={(e) => setNewManagerForm(prev => ({ ...prev, practice_name: e.target.value }))}
                placeholder="e.g. Sarah Johnson"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateManagerDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateManager} disabled={creatingManager}>
                {creatingManager && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Manager
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign-before-delete dialog for managers with assigned clients */}
      <Dialog open={!!deletingManagerId} onOpenChange={(o) => { if (!o) { setDeletingManagerId(null); setReassignSelections({}); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Reassign Clients Before Removing Manager
            </DialogTitle>
          </DialogHeader>
          {deletingManagerId && (() => {
            const mgr = profiles.find(p => p.user_id === deletingManagerId);
            const assignments = allAssignments.filter(a => a.manager_user_id === deletingManagerId);
            const candidates = profiles.filter(p => p.user_id !== deletingManagerId && (isUserManager(p.user_id) || isUserAdmin(p.user_id)));
            const allChosen = assignments.every(a => reassignSelections[a.client_user_id]);
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{mgr?.practice_name || mgr?.email}</span> currently manages {assignments.length} client account(s). Choose a new manager (or admin) for each before removing this manager.
                </p>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {assignments.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
                      <div className="text-sm font-medium">{getProfileName(a.client_user_id)}</div>
                      <Select
                        value={reassignSelections[a.client_user_id] || ''}
                        onValueChange={(v) => setReassignSelections(prev => ({ ...prev, [a.client_user_id]: v }))}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Reassign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {candidates.map(c => (
                            <SelectItem key={c.user_id} value={c.user_id}>
                              {c.practice_name || c.email} {isUserAdmin(c.user_id) ? '(Admin)' : '(Manager)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setDeletingManagerId(null); setReassignSelections({}); }}>Cancel</Button>
                  <Button
                    variant="destructive"
                    disabled={!allChosen}
                    onClick={async () => {
                      if (!user) return;
                      // Reassign each client
                      for (const a of assignments) {
                        const newMgr = reassignSelections[a.client_user_id];
                        if (!newMgr) continue;
                        // Avoid duplicate-key conflict if new manager already assigned
                        const exists = allAssignments.some(x => x.manager_user_id === newMgr && x.client_user_id === a.client_user_id);
                        if (!exists) {
                          const { error } = await supabase.from('manager_assignments').insert({
                            manager_user_id: newMgr,
                            client_user_id: a.client_user_id,
                            assigned_by: user.id,
                          });
                          if (error) { toast.error(`Failed to reassign ${getProfileName(a.client_user_id)}`); return; }
                        }
                      }
                      // Remove old manager's assignments
                      const { error: delAssignErr } = await supabase.from('manager_assignments').delete().eq('manager_user_id', deletingManagerId);
                      if (delAssignErr) { toast.error('Failed to clear old assignments'); return; }
                      // Remove manager role
                      const { error: roleErr } = await supabase.from('user_roles').delete().eq('user_id', deletingManagerId).eq('role', 'manager' as any);
                      if (roleErr) { toast.error('Failed to remove manager role'); return; }
                      toast.success('Clients reassigned and manager removed');
                      setDeletingManagerId(null);
                      setReassignSelections({});
                      refetchRoles();
                      refetchAssignments();
                    }}
                  >
                    Reassign & Remove Manager
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Move KB Document Dialog */}
      <Dialog open={!!movingKBDoc} onOpenChange={(v) => !v && setMovingKBDoc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="w-5 h-5 text-primary" />
              Move document
            </DialogTitle>
          </DialogHeader>
          {movingKBDoc && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Moving:</span>{' '}
                <span className="font-medium">{movingKBDoc.title}</span>
              </div>
              <div className="space-y-2">
                <Label>Target client / practice</Label>
                <Select value={moveTargetUserId} onValueChange={loadLocationsForTarget}>
                  <SelectTrigger><SelectValue placeholder="Select a practice" /></SelectTrigger>
                  <SelectContent>
                    {visibleProfiles
                      .filter(p => p.user_id !== movingKBDoc.user_id)
                      .map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.practice_name || p.email || p.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={moveScope} onValueChange={(v) => setMoveScope(v as 'group' | 'location')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="location">Single location</SelectItem>
                    <SelectItem value="group">Group (all locations)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {moveScope === 'location' && moveLocations.length > 0 && (
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select value={moveLocationId} onValueChange={setMoveLocationId}>
                    <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                    <SelectContent>
                      {moveLocations.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}{l.is_default ? ' (default)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setMovingKBDoc(null)} disabled={movingDoc}>Cancel</Button>
                <Button
                  onClick={handleMoveKBDoc}
                  disabled={movingDoc || !moveTargetUserId || (moveScope === 'location' && !moveLocationId)}
                >
                  {movingDoc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderInput className="w-4 h-4 mr-2" />}
                  Move
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
