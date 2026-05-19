import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useAuth } from '@/hooks/useAuth';
import { useCampaignsNew, CampaignChannel, ChannelType, PlatformType, CampaignStatus } from '@/hooks/useCampaignsNew';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';
import { 
  platformIcons, 
  platformColors, 
  platformLabels, 
  channelLabels,
  getPlatformsByChannel,
  getChannelForPlatform,
} from '@/lib/platformIcons';
import ChannelCredentialModal, { ChannelCredentials, CredentialEditData } from '@/components/channel/ChannelCredentialModal';
import PlatformCredentialCards from '@/components/channel/PlatformCredentialCards';
import { useChannelCredentials } from '@/hooks/useChannelCredentials';
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Share2, 
  Mail, 
  MessageSquare,
  Trash2,
  ChevronDown,
  KeyRound,
  Pencil,
  FileSearch,
  Bot,
  Sparkles,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import GeneratePracticeReportDialog from '@/components/dashboard/GeneratePracticeReportDialog';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformRules } from '@/hooks/usePlatformRules';
import { useCampaignAddons } from '@/hooks/useCampaignAddons';
import CampaignAddonDialog, { CAMPAIGN_ADDONS, AddonInfo } from '@/components/campaign/CampaignAddonDialog';
import CampaignAgentDialog from '@/components/campaign/CampaignAgentDialog';
import CampaignBudgetDialog from '@/components/campaign/CampaignBudgetDialog';
import ContentHubDialog from '@/components/campaign/ContentHubDialog';
import AddCustomAddonDialog, { CustomAddonData } from '@/components/campaign/AddCustomAddonDialog';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { useCampaignBudget } from '@/hooks/useCampaignBudget';
import { DollarSign } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import CampaignGanttChart from "@/components/campaign/CampaignGanttChart";
import CampaignDashboardSection from "@/components/campaign/CampaignDashboardSection";
import { CheckCircle, ExternalLink, Globe, Loader2, Send, Clock, RefreshCw, Save } from 'lucide-react';
import EditPostDialog from '@/components/channel/EditPostDialog';
import type { ChannelPost } from '@/hooks/useCampaignsNew';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const statusColors: Record<CampaignStatus, string> = {
  developing: 'bg-amber-500/20 text-amber-600 hover:bg-amber-500/30',
  scheduled: 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30',
  active: 'bg-green-500/20 text-green-600 hover:bg-green-500/30',
  ended: 'bg-muted text-muted-foreground hover:bg-muted/80',
  canceled: 'bg-destructive/20 text-destructive hover:bg-destructive/30',
};

const statusLabels: Record<CampaignStatus, string> = {
  developing: 'Developing',
  scheduled: 'Scheduled',
  active: 'Active',
  ended: 'Ended',
  canceled: 'Canceled',
};

const allStatuses: CampaignStatus[] = ['developing', 'scheduled', 'active', 'ended', 'canceled'];

const CampaignEditNew = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agentSearchParams] = useSearchParams();
  const { user, isAdmin, isManager } = useAuth();
  const { useCampaignWithChannels, addChannel, removeChannel, updateCampaign, addPost, updatePost, deletePost } = useCampaignsNew();
  const { data: campaign, isLoading, refetch: refetchCampaign } = useCampaignWithChannels(id);

  const { data: campaignOwnerProfile, refetch: refetchOwnerProfile } = useQuery({
    queryKey: ['campaign-owner-profile-full', campaign?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('practice_name, email, campaign_focus, target_audience, user_id')
        .eq('user_id', campaign!.user_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!campaign?.user_id,
  });
  
  const [showChannelsDialog, setShowChannelsDialog] = useState(false);
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType | null>(null);
  const [showAddChannelDialog, setShowAddChannelDialog] = useState(false);
  const [showCustomChannelModal, setShowCustomChannelModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState<CredentialEditData | null>(null);
  const [prefillPlatformName, setPrefillPlatformName] = useState<string | undefined>(undefined);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const { credentials, addCredential, updateCredential, deleteCredential } = useChannelCredentials();
  const { profile } = useProfile();
  const [showReportDialog, setShowReportDialog] = useState(false);
  const { ensurePlatformRules } = usePlatformRules();
  const { addons, addAddon, removeAddon } = useCampaignAddons(id);

  // FIX #1: Custom addons now persisted via custom_label/custom_icon columns (Migration E).
  // Derive the AddonInfo shape from DB rows so they survive page refresh.
  const customAddons: AddonInfo[] = addons
    .filter((a) => a.custom_label)
    .map((a) => ({
      key: a.addon_type,
      label: a.custom_label!,
      icon: a.custom_icon || '📌',
      description: '',
    }));
  const [showAddonDialog, setShowAddonDialog] = useState(false);
  const [selectedAddon, setSelectedAddon] = useState<AddonInfo | null>(null);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  // Auto-open Campaign Agent when arriving with ?agent=1
  React.useEffect(() => {
    if (agentSearchParams.get('agent') === '1' && campaign && !showAgentDialog) {
      setShowAgentDialog(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id]);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [showCustomAddonDialog, setShowCustomAddonDialog] = useState(false);
  const [showContentHubDialog, setShowContentHubDialog] = useState(false);
  // customAddons now derived from DB — see useCampaignAddons above
  const { documents: ownKbDocs } = useKnowledgeBase();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isEditingStrategy, setIsEditingStrategy] = useState(false);
  const [editStrategy, setEditStrategy] = useState('');
  const { budget, upsertBudget } = useCampaignBudget(id);
  const [showLandingPagePrompt, setShowLandingPagePrompt] = useState(false);
  const [isAcceptingPlan, setIsAcceptingPlan] = useState(false);
  const [isGeneratingLanding, setIsGeneratingLanding] = useState(false);
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [editFocus, setEditFocus] = useState('');
  const [editTargetAudience, setEditTargetAudience] = useState('');
  const [editBudgetTarget, setEditBudgetTarget] = useState<string>('');
  const [isSavingFocus, setIsSavingFocus] = useState(false);
  const [showStrategyDialog, setShowStrategyDialog] = useState(false);
  const [strategyDraft, setStrategyDraft] = useState('');
  const [isSavingStrategy, setIsSavingStrategy] = useState(false);
  const [showDeleteStrategyConfirm, setShowDeleteStrategyConfirm] = useState(false);
  const [editLandingUrl, setEditLandingUrl] = useState('');
  const [isSavingLanding, setIsSavingLanding] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingScheduledPost, setEditingScheduledPost] = useState<{ post: ChannelPost; channelId: string; platform: PlatformType } | null>(null);

  // Inline-editable budget table draft
  const [isEditingBudgetInline, setIsEditingBudgetInline] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<{ total: number; allocations: Record<string, { amount: number; percent: number }> }>({ total: 0, allocations: {} });
  const [isSavingBudgetInline, setIsSavingBudgetInline] = useState(false);

  // Sync landing page input with campaign data
  React.useEffect(() => {
    setEditLandingUrl((campaign as any)?.landing_page_url || '');
  }, [(campaign as any)?.landing_page_url]);

  // Poll generation_status while a background asset-generation job is running.
  const generationStatus: string | null = (campaign as any)?.generation_status ?? null;
  const generationError: string | null = (campaign as any)?.generation_error ?? null;
  const lastGenStatusRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!id) return;
    if (generationStatus !== 'processing') {
      if (lastGenStatusRef.current === 'processing' && generationStatus === 'completed') {
        toast.success('Campaign assets ready');
      }
      if (lastGenStatusRef.current === 'processing' && generationStatus === 'failed') {
        toast.error('Asset generation failed', { description: generationError || undefined });
      }
      lastGenStatusRef.current = generationStatus;
      return;
    }
    lastGenStatusRef.current = 'processing';
    const interval = window.setInterval(() => { refetchCampaign(); }, 4000);
    return () => window.clearInterval(interval);
  }, [generationStatus, generationError, id, refetchCampaign]);

  const saveLandingUrl = async () => {
    if (!id) return;
    setIsSavingLanding(true);
    try {
      await updateCampaign.mutateAsync({ id, landing_page_url: editLandingUrl.trim() || null } as any);
      toast.success('Landing page URL saved');
    } catch (e: any) {
      toast.error('Failed to save landing page URL', { description: e?.message });
    } finally {
      setIsSavingLanding(false);
    }
  };


  const saveFocus = async () => {
    if (!campaign?.user_id) return;
    setIsSavingFocus(true);
    try {
      const bt = editBudgetTarget.trim() === '' ? null : Number(editBudgetTarget);
      await supabase
        .from('profiles')
        .update({
          campaign_focus: editFocus,
          target_audience: editTargetAudience,
          ...(bt === null || !isNaN(bt as number) ? { budget_target: bt } : {}),
        } as any)
        .eq('user_id', campaign.user_id);
      await refetchOwnerProfile();
      setIsEditingFocus(false);
      toast.success('Campaign focus updated');
    } catch (e: any) {
      toast.error('Failed to update focus', { description: e?.message });
    } finally {
      setIsSavingFocus(false);
    }
  };

  // Load KB docs for the campaign OWNER (not necessarily the logged-in user)
  const { data: campaignOwnerKbDocs = [] } = useQuery({
    queryKey: ['campaign-owner-kb', campaign?.user_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('knowledge_base')
        .select('*')
        .eq('user_id', campaign!.user_id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!campaign?.user_id && campaign?.user_id !== user?.id,
  });
  const kbDocs = campaign?.user_id && campaign.user_id !== user?.id ? campaignOwnerKbDocs : ownKbDocs;

  // Smart report: check if a market_analysis report exists within 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const hasRecentReport = kbDocs.some(
    (d: any) => d.doc_type === 'market_analysis' && new Date(d.updated_at) > sixMonthsAgo
  );

  // Get system prompt and practice report for campaign agent (from campaign owner's KB)
  const systemPromptDoc = kbDocs.find((d: any) => d.doc_type === 'system_prompt');
  const practiceReportDoc = kbDocs.find((d: any) => d.doc_type === 'market_analysis');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary-foreground">Loading...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Campaign not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  // Group channels by type
  const channelsByType = campaign.campaign_channels.reduce((acc, channel) => {
    const type = channel.channel_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(channel);
    return acc;
  }, {} as Record<ChannelType, CampaignChannel[]>);

  const channelTypes: { type: ChannelType; icon: React.ReactNode; label: string }[] = [
    { type: 'social_media', icon: <Share2 className="w-6 h-6" />, label: 'Social Media' },
    { type: 'email', icon: <Mail className="w-6 h-6" />, label: 'Email' },
    { type: 'sms', icon: <MessageSquare className="w-6 h-6" />, label: 'Text/SMS' },
  ];

  const handleAddPlatform = async (platform: PlatformType) => {
    if (!id) return;
    
    await addChannel.mutateAsync({
      campaign_id: id,
      channel_type: getChannelForPlatform(platform),
      platform,
    });
    setShowAddChannelDialog(false);

    // Auto-ensure platform posting rules exist in client KB
    ensurePlatformRules(platform);
  };

  const handleRemoveChannel = async (channelId: string) => {
    if (!id) return;
    await removeChannel.mutateAsync({ id: channelId, campaignId: id });
  };

  const handleCustomChannel = (credentials: ChannelCredentials) => {
    if (editingCredential) {
      updateCredential.mutate({
        id: editingCredential.id,
        platform_name: credentials.platformName,
        platform_url: credentials.platformUrl || null,
        username: credentials.username || null,
        password: credentials.password || null,
      });
    } else {
      addCredential.mutate({
        platform_name: credentials.platformName,
        platform_url: credentials.platformUrl || undefined,
        username: credentials.username || undefined,
        password: credentials.password || undefined,
      });
    }
    setEditingCredential(null);
    setShowAddChannelDialog(false);
  };

  const handleDeleteCredential = (id: string) => {
    deleteCredential.mutate(id);
  };

  const handleEditCredential = (cred: CredentialEditData) => {
    setEditingCredential(cred);
    setShowCustomChannelModal(true);
  };

  const handleStatusChange = async (newStatus: CampaignStatus) => {
    if (!id) return;
    await updateCampaign.mutateAsync({ id, status: newStatus });
  };

  const handleStartDateChange = async (date: Date | undefined) => {
    if (!id) return;
    await updateCampaign.mutateAsync({ id, start_date: date?.toISOString() || null });
    setStartDateOpen(false);
  };

  const handleEndDateChange = async (date: Date | undefined) => {
    if (!id) return;
    await updateCampaign.mutateAsync({ id, end_date: date?.toISOString() || null });
    setEndDateOpen(false);
  };

  const ensureLandingPage = async (): Promise<boolean> => {
    if (!id) return false;
    if ((campaign as any)?.landing_page_url) return true;
    setIsGeneratingLanding(true);
    try {
      toast.info('No landing page set — generating a placeholder hero…', { duration: 4000 });
      const { data, error } = await supabase.functions.invoke('generate-landing-page', {
        body: { campaignId: id, placeholder: true },
      });
      if (error) throw error;
      toast.success('Placeholder landing page created', { description: data?.url });
      await refetchCampaign();
      return true;
    } catch (e: any) {
      console.error('Placeholder landing page error:', e);
      toast.error('Failed to generate placeholder landing page', { description: e?.message || 'Unknown error' });
      return false;
    } finally {
      setIsGeneratingLanding(false);
    }
  };

  const ensureDefaultChannels = async () => {
    if (!id || !campaign) return;
    if ((campaign.campaign_channels || []).length > 0) return;
    const defaults: Array<{ platform: any; channel_type: any }> = [
      { platform: 'linkedin', channel_type: 'social_media' },
      { platform: 'instagram', channel_type: 'social_media' },
      { platform: 'internal_email', channel_type: 'email' },
    ];
    for (const d of defaults) {
      try {
        await addChannel.mutateAsync({ campaign_id: id, ...d });
      } catch (e) {
        console.warn('addChannel failed', d, e);
      }
    }
    await refetchCampaign();
  };

  const acceptPlanAndGenerate = async () => {
    if (!id) return;
    setIsAcceptingPlan(true);
    try {
      // Auto-create a placeholder landing page if none was provided
      if (!(campaign as any)?.landing_page_url) {
        await ensureLandingPage();
      }

      // Parse the agent's strategy for channel + addon allocations
      let parsed: { total_amount: number; channels: any[]; addons: any[] } | null = null;
      try {
        const { data, error } = await supabase.functions.invoke('parse-strategy-allocations', {
          body: { campaignId: id },
        });
        if (error) throw error;
        parsed = data as any;
      } catch (e) {
        console.warn('parse-strategy-allocations failed, falling back to defaults', e);
      }

      // Ensure every channel from the strategy exists. If parsing failed or
      // returned none, fall back to the original default set.
      const existingChannels = (campaign?.campaign_channels || []) as any[];
      const desiredChannels = parsed?.channels?.length
        ? parsed.channels.map((c) => ({ platform: c.platform, channel_type: c.channel_type }))
        : [];
      const channelsToCreate = desiredChannels.filter(
        (d) => !existingChannels.some((e) => e.platform === d.platform),
      );
      for (const d of channelsToCreate) {
        try { await addChannel.mutateAsync({ campaign_id: id, ...(d as any) }); }
        catch (e) { console.warn('addChannel failed', d, e); }
      }
      if (existingChannels.length === 0 && channelsToCreate.length === 0) {
        await ensureDefaultChannels();
      }

      // Ensure every recommended addon exists.
      const existingAddonKeys = new Set(addons.map((a) => a.addon_type));
      for (const a of parsed?.addons || []) {
        if (!existingAddonKeys.has(a.addon_type)) {
          try { await addAddon.mutateAsync({ campaign_id: id, addon_type: a.addon_type }); }
          catch (e) { console.warn('addAddon failed', a.addon_type, e); }
        }
      }

      // Build full budget allocations: every channel + every addon, keyed namespaced.
      if (parsed && parsed.total_amount > 0) {
        const allocations: Record<string, { percent: number; amount: number }> = {};
        for (const c of parsed.channels || []) {
          allocations[`channel:${c.platform}`] = { percent: c.percent || 0, amount: c.amount || 0 };
        }
        for (const a of parsed.addons || []) {
          allocations[`addon:${a.addon_type}`] = { percent: a.percent || 0, amount: a.amount || 0 };
        }
        try {
          await upsertBudget.mutateAsync({
            campaign_id: id,
            total_amount: parsed.total_amount,
            allocations,
            accepted: true,
          });
        } catch (e) {
          console.warn('upsertBudget failed', e);
        }
      }

      await updateCampaign.mutateAsync({ id, status: 'scheduled' });
      toast.info('Generating campaign assets in the background — this can take a minute or two…', { duration: 5000 });
      const { error } = await supabase.functions.invoke('generate-campaign-content', {
        body: { campaignId: id, strategy: campaign?.strategy || undefined },
      });
      if (error) throw error;
      // Background job kicked off; polling effect below will surface completion.
      await refetchCampaign();
    } catch (e: any) {
      console.error('Accept plan error:', e);
      toast.error('Failed to generate campaign', { description: e?.message || 'Unknown error' });
    } finally {
      setIsAcceptingPlan(false);
    }
  };


  const regenerateLandingPage = async () => {
    if (!id) return;
    setIsGeneratingLanding(true);
    try {
      toast.info('Regenerating landing page…');
      const { data, error } = await supabase.functions.invoke('generate-landing-page', {
        body: { campaignId: id, placeholder: !campaign?.strategy },
      });
      if (error) throw error;
      toast.success('Landing page ready', { description: data?.url });
      await refetchCampaign();
    } catch (e: any) {
      toast.error('Failed to regenerate landing page', { description: e?.message });
    } finally {
      setIsGeneratingLanding(false);
    }
  };

  // Flatten all scheduled posts across channels for the schedule view.
  const allPosts = (campaign?.campaign_channels || []).flatMap((ch: any) =>
    (ch.channel_posts || []).map((p: ChannelPost) => ({
      post: p,
      channelId: ch.id,
      platform: ch.platform as PlatformType,
    }))
  );
  const sortedPosts = [...allPosts].sort((a, b) => {
    const aT = a.post.scheduled_start ? new Date(a.post.scheduled_start).getTime() : Infinity;
    const bT = b.post.scheduled_start ? new Date(b.post.scheduled_start).getTime() : Infinity;
    return aT - bT;
  });

  const publishCampaign = async () => {
    if (!id || !campaign) return;
    if (!campaign.start_date || !campaign.end_date) {
      toast.error('Set a campaign start and end date before publishing.');
      return;
    }
    const channels = campaign.campaign_channels || [];
    if (channels.length === 0) {
      toast.error('Add at least one channel before publishing.');
      return;
    }
    const winStart = new Date(campaign.start_date).getTime();
    const winEnd = new Date(campaign.end_date).getTime();
    const issues: string[] = [];
    const draftPostIds: string[] = [];

    for (const ch of channels) {
      const posts = (ch as any).channel_posts || [];
      if (posts.length === 0) {
        issues.push(`${platformLabels[ch.platform as PlatformType] || ch.platform}: no posts`);
        continue;
      }
      for (const p of posts) {
        if (!p.scheduled_start) {
          issues.push(`${platformLabels[ch.platform as PlatformType]}: "${p.title || 'Untitled'}" is not scheduled`);
          continue;
        }
        const t = new Date(p.scheduled_start).getTime();
        if (t < winStart || t > winEnd) {
          issues.push(`${platformLabels[ch.platform as PlatformType]}: "${p.title || 'Untitled'}" is outside the campaign window`);
        }
        if (p.status !== 'scheduled' && p.status !== 'published') {
          draftPostIds.push(p.id);
        }
      }
    }

    if (issues.length > 0) {
      toast.error('Cannot publish — schedule has issues', {
        description: issues.slice(0, 5).join(' • ') + (issues.length > 5 ? ` (+${issues.length - 5} more)` : ''),
        duration: 8000,
      });
      return;
    }

    setIsPublishing(true);
    try {
      // FIX #2: Single batched UPDATE instead of N+1 sequential awaits
      if (draftPostIds.length > 0) {
        const { error: batchErr } = await supabase
          .from('channel_posts')
          .update({ status: 'scheduled' })
          .in('id', draftPostIds);
        if (batchErr) throw batchErr;
      }
      await updateCampaign.mutateAsync({ id, status: 'active' });
      toast.success('Campaign published! All posts queued for their scheduled times.');
      await refetchCampaign();
    } catch (e: any) {
      toast.error('Failed to publish', { description: e?.message });
    } finally {
      setIsPublishing(false);
    }
  };


  const getFilteredChannels = () => {
    if (!selectedChannelType) return campaign.campaign_channels;
    return channelsByType[selectedChannelType] || [];
  };

  const PublishButton = ({ size = 'default' as 'default' | 'sm' }) => (
    <Button
      size={size}
      disabled={isPublishing || campaign?.status === 'active'}
      className={
        campaign?.status === 'active'
          ? 'bg-muted text-muted-foreground cursor-not-allowed font-bold'
          : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
      }
      onClick={publishCampaign}
      title="Validate the schedule and publish the campaign"
    >
      {isPublishing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
      {campaign?.status === 'active' ? 'Published' : 'Publish Campaign'}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-8 md:py-12">
        {generationStatus === 'processing' && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Generating campaign assets in the background — posts and images will appear here as they're ready.</span>
          </div>
        )}
        {generationStatus === 'failed' && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
            <span className="text-destructive">Asset generation failed{generationError ? `: ${generationError}` : ''}.</span>
            <Button size="sm" variant="outline" onClick={acceptPlanAndGenerate} disabled={isAcceptingPlan}>Retry</Button>
          </div>
        )}
        {/* Campaign Header */}
        <div className="mb-8">
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold max-w-md"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editName.trim() && id) {
                      updateCampaign.mutateAsync({ id, name: editName.trim() });
                    }
                    setIsEditingName(false);
                  }
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
              />
              <Button size="sm" onClick={() => {
                if (editName.trim() && id) {
                  updateCampaign.mutateAsync({ id, name: editName.trim() });
                }
                setIsEditingName(false);
              }}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}>Cancel</Button>
            </div>
          ) : (
            <h1
              className="text-2xl md:text-3xl font-bold text-foreground mb-2 cursor-pointer hover:text-primary transition-colors group"
              onClick={() => { setEditName(campaign.name); setIsEditingName(true); }}
              title="Click to edit campaign name"
            >
              {campaign.name || <span className="text-muted-foreground italic">Click to add campaign name</span>}
              <Pencil className="w-4 h-4 inline ml-2 opacity-0 group-hover:opacity-50 transition-opacity" />
            </h1>
          )}
          {(isAdmin || isManager) && campaign.user_id !== user?.id && campaignOwnerProfile && (
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="gap-1 text-sm border-primary/50 text-primary">
                <User className="w-3 h-3" />
                Client: {campaignOwnerProfile.practice_name || campaignOwnerProfile.email || 'Unknown'}
              </Badge>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-auto px-2 py-1 text-sm font-normal",
                      !campaign.start_date && "text-muted-foreground"
                    )}
                  >
                    {campaign.start_date 
                      ? format(new Date(campaign.start_date), 'MMM d, yyyy')
                      : 'Set start date'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border border-border z-50" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={campaign.start_date ? new Date(campaign.start_date) : undefined}
                    onSelect={handleStartDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span>—</span>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-auto px-2 py-1 text-sm font-normal",
                      !campaign.end_date && "text-muted-foreground"
                    )}
                  >
                    {campaign.end_date 
                      ? format(new Date(campaign.end_date), 'MMM d, yyyy')
                      : 'Set end date'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border border-border z-50" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={campaign.end_date ? new Date(campaign.end_date) : undefined}
                    onSelect={handleEndDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-1 px-2.5 py-0.5 h-auto text-xs font-semibold rounded-full border-0 ${statusColors[campaign.status]}`}
                >
                  {statusLabels[campaign.status]}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-card border border-border z-50">
                {allStatuses.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={`cursor-pointer ${campaign.status === status ? 'bg-accent' : ''}`}
                  >
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[status]}`}>
                      {statusLabels[status]}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {!hasRecentReport && (
              <Button variant="outline" size="sm" onClick={() => setShowReportDialog(true)}>
                <FileSearch className="w-4 h-4 mr-1" />
                Practice Report
              </Button>
            )}
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowAgentDialog(true)}
            >
              <Bot className="w-4 h-4 mr-1" />
              Campaign Agent
            </Button>
            <PublishButton size="sm" />
          </div>
        </div>

        {/* Collapsible sections */}
        <Accordion type="multiple" defaultValue={["focus"]} className="space-y-3">

          {/* Focus */}
          <AccordionItem value="focus" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center justify-between w-full pr-4">
                <span className="text-base font-semibold text-foreground">Focus</span>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              {isEditingFocus ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Campaign Focus</label>
                    <Textarea
                      value={editFocus}
                      onChange={(e) => setEditFocus(e.target.value)}
                      placeholder="Describe what this campaign is focused on (offer, goals)…"
                      className="min-h-[120px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Target Market</label>
                    <Textarea
                      value={editTargetAudience}
                      onChange={(e) => setEditTargetAudience(e.target.value)}
                      placeholder="Describe the target market / audience for this campaign…"
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Budget Target</label>
                    <div className="relative max-w-xs">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0}
                        value={editBudgetTarget}
                        onChange={(e) => setEditBudgetTarget(e.target.value)}
                        placeholder="e.g. 5000"
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={isSavingFocus} onClick={saveFocus}>
                      {isSavingFocus ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingFocus(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div
                  className="cursor-pointer rounded-md border border-dashed p-4 hover:bg-accent/40 transition-colors space-y-3"
                  onClick={() => {
                    setEditFocus(campaignOwnerProfile?.campaign_focus || '');
                    setEditTargetAudience((campaignOwnerProfile as any)?.target_audience || '');
                    setEditBudgetTarget(
                      (campaignOwnerProfile as any)?.budget_target != null
                        ? String((campaignOwnerProfile as any).budget_target)
                        : ''
                    );
                    setIsEditingFocus(true);
                  }}
                >
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Campaign Focus</p>
                    {campaignOwnerProfile?.campaign_focus ? (
                      <p className="text-foreground whitespace-pre-wrap">{campaignOwnerProfile.campaign_focus}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No campaign focus set yet. Click to add one.</p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Target Market</p>
                    {(campaignOwnerProfile as any)?.target_audience ? (
                      <p className="text-foreground whitespace-pre-wrap">{(campaignOwnerProfile as any).target_audience}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No target market set yet. Click to add one.</p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Budget Target</p>
                    {(campaignOwnerProfile as any)?.budget_target != null ? (
                      <p className="text-foreground">${Number((campaignOwnerProfile as any).budget_target).toLocaleString()}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No budget target set yet. Click to add one.</p>
                    )}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Strategic Plan — clicking the row opens a full-window editor */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setStrategyDraft(campaign.strategy || ''); setShowStrategyDialog(true); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setStrategyDraft(campaign.strategy || '');
                setShowStrategyDialog(true);
              }
            }}
            className="border rounded-lg bg-card px-4 py-4 cursor-pointer hover:bg-accent/40 transition-colors flex items-center justify-between gap-2 flex-wrap"
            title="Open Strategic Plan editor"
          >
            <span className="text-base font-semibold text-foreground inline-flex items-center gap-2 flex-wrap">
              <Bot className="w-4 h-4 text-primary" />
              Strategic Plan
              {campaign.strategy && <Badge variant="outline" className="ml-1">Ready</Badge>}
              {campaign.strategy && (() => {
                const isAccepted = campaign.status !== 'developing';
                const hasArticle = !!(campaign as any).blog_article;
                return (
                  <Button
                    size="sm"
                    disabled={isAcceptingPlan || (isAccepted && hasArticle)}
                    className={
                      isAccepted && hasArticle
                        ? 'bg-muted text-muted-foreground cursor-not-allowed font-bold ml-2'
                        : 'bg-purple-600 hover:bg-purple-700 text-white font-bold ml-2'
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAccepted && hasArticle) return;
                      setShowContentHubDialog(true);
                    }}
                  >
                    {isAcceptingPlan ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    {isAccepted && hasArticle ? 'Topic Generator Ready' : 'Topic Generator'}
                  </Button>
                );
              })()}
            </span>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Pencil className="w-3.5 h-3.5" /> Open
            </span>
          </div>

          {/* Budget — click to open editable budget dialog */}
          <div className="border rounded-lg bg-card px-4">
            <button
              type="button"
              onClick={() => setShowBudgetDialog(true)}
              className="w-full py-4 flex items-center justify-between hover:opacity-90 transition-opacity text-left"
            >
              <span className="text-base font-semibold text-foreground inline-flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Budget
                {budget && budget.total_amount > 0 && (
                  <Badge className="bg-green-500 text-white hover:bg-green-600 ml-1">
                    ${budget.total_amount.toLocaleString()}
                  </Badge>
                )}
                {budget?.accepted && (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 ml-1">
                    ✓ Accepted
                  </Badge>
                )}
              </span>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </span>
            </button>
          </div>


          {/* Landing Page */}
          <AccordionItem value="landing" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center justify-between w-full pr-4">
                <span className="text-base font-semibold text-foreground inline-flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Landing Page
                </span>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isGeneratingLanding}
                  onClick={regenerateLandingPage}
                >
                  {isGeneratingLanding ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  {(campaign as any)?.landing_page_url ? 'Regenerate' : 'Generate'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter an existing landing page URL, or click Regenerate to (re)build a hosted page from
                the campaign strategy.
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <Input
                  type="url"
                  placeholder="https://your-landing-page.com"
                  value={editLandingUrl}
                  onChange={(e) => setEditLandingUrl(e.target.value)}
                  className="flex-1 min-w-[260px]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSavingLanding || editLandingUrl === ((campaign as any)?.landing_page_url || '')}
                  onClick={saveLandingUrl}
                >
                  {isSavingLanding ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Save
                </Button>
              </div>
              {(campaign as any)?.landing_page_url && (() => {
                const storedUrl: string = (campaign as any).landing_page_url;
                const hasHtml = !!(campaign as any)?.landing_page_html;
                const isEdgeFnUrl = /\/functions\/v1\/serve-landing-page/i.test(storedUrl);
                const displayUrl = hasHtml && (isEdgeFnUrl || storedUrl.includes(`/landing/${id}`))
                  ? `${window.location.origin}/landing/${id}`
                  : storedUrl;
                return (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Current:</span>
                    <a
                      href={displayUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 break-all"
                    >
                      {displayUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })()}
            </AccordionContent>
          </AccordionItem>

          {/* Channels */}
          <AccordionItem value="channels" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center justify-between w-full pr-4">
                <span className="text-base font-semibold text-foreground inline-flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-primary" />
                  Channels
                  <Badge variant="outline" className="ml-1">{campaign.campaign_channels.length}</Badge>
                </span>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setShowAddChannelDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Channel
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {channelTypes.map(({ type, icon, label }) => {
                  const channels = channelsByType[type] || [];
                  const count = channels.length;
                  return (
                    <Card
                      key={type}
                      className={`cursor-pointer transition-all hover:shadow-lg ${count > 0 ? 'border-primary/50' : ''}`}
                      onClick={() => {
                        setSelectedChannelType(type);
                        if (count > 0) setShowChannelsDialog(true);
                        else setShowAddChannelDialog(true);
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-3 text-lg">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
                          {label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-foreground mb-1">{count}</div>
                        <p className="text-sm text-muted-foreground">
                          {count === 0 ? 'Tap to add a platform' : count === 1 ? 'platform connected' : 'platforms connected'}
                        </p>
                        {count > 0 && (
                          <div className="flex gap-1 mt-3">
                            {channels.slice(0, 4).map((channel) => (
                              <div
                                key={channel.id}
                                className={`w-8 h-8 rounded-full flex items-center justify-center ${platformColors[channel.platform]}`}
                              >
                                <div className="w-4 h-4">{platformIcons[channel.platform]}</div>
                              </div>
                            ))}
                            {count > 4 && (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                +{count - 4}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {credentials.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <KeyRound className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Platform Credentials</h3>
                  </div>
                  <PlatformCredentialCards
                    credentials={credentials}
                    onEdit={handleEditCredential}
                    onAddAnother={(platformName) => {
                      setEditingCredential(null);
                      setPrefillPlatformName(platformName);
                      setShowCustomChannelModal(true);
                    }}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Vectors */}
          <AccordionItem value="vectors" className="border rounded-lg bg-card px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center justify-between w-full pr-4">
                <span className="text-base font-semibold text-foreground inline-flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Vectors
                  {addons.map((a) => {
                    const allDefs = [...CAMPAIGN_ADDONS, ...customAddons];
                    const info = allDefs.find((ad) => ad.key === a.addon_type);
                    return (
                      <Badge key={a.id} variant="outline" className="gap-1 font-normal">
                        <span>{info?.icon}</span>
                        <span>{info?.label || a.addon_type}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Remove ${info?.label || a.addon_type}`}
                          className="ml-1 inline-flex items-center justify-center rounded-full hover:bg-destructive/15 text-destructive cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            removeAddon.mutate(a.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              e.preventDefault();
                              removeAddon.mutate(a.id);
                            }
                          }}
                        >
                          <X className="w-3 h-3" />
                        </span>
                      </Badge>
                    );
                  })}
                </span>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Expand your campaign with additional marketing channels and strategies.
                </p>
                <div className="flex gap-2">
                  {(isAdmin || isManager) && (
                    <Button variant="outline" size="sm" onClick={() => setShowCustomAddonDialog(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Vector
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {[...CAMPAIGN_ADDONS, ...customAddons].map((addon) => {
                  const includedRow = addons.find((a) => a.addon_type === addon.key);
                  const isIncluded = !!includedRow;
                  return (
                    <Card
                      key={addon.key}
                      className={`relative cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                        isIncluded ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => {
                        setSelectedAddon(addon);
                        setShowAddonDialog(true);
                      }}
                    >
                      {isIncluded && includedRow && (
                        <button
                          type="button"
                          aria-label={`Remove ${addon.label} from campaign`}
                          className="absolute top-1 right-1 z-10 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAddon.mutate(includedRow.id);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      <CardContent className="p-3 text-center">
                        <div className="text-2xl mb-1">{addon.icon}</div>
                        <div className="text-xs font-medium text-foreground">{addon.label}</div>
                        {isIncluded && (
                          <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0">
                            ✓ Included
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>


        {/* Bottom Publish Button */}
        <div className="mt-10 mb-12 flex justify-center">
          <PublishButton size="default" />
        </div>
      </main>

      {/* Edit a scheduled post inline */}
      <EditPostDialog
        open={!!editingScheduledPost}
        onOpenChange={(o) => { if (!o) setEditingScheduledPost(null); }}
        post={editingScheduledPost?.post || null}
        onSave={async (data) => {
          if (!editingScheduledPost) return;
          await updatePost.mutateAsync({
            id: editingScheduledPost.post.id,
            channelId: editingScheduledPost.channelId,
            title: data.title,
            text_content: data.text_content,
            image_url: data.image_url,
          });
          await refetchCampaign();
        }}
        onDelete={async (postId) => {
          if (!editingScheduledPost) return;
          await deletePost.mutateAsync({ id: postId, channelId: editingScheduledPost.channelId });
          setEditingScheduledPost(null);
          await refetchCampaign();
        }}
        onDuplicate={async (data) => {
          if (!editingScheduledPost) return;
          await addPost.mutateAsync({
            campaign_channel_id: editingScheduledPost.channelId,
            title: data.title,
            text_content: data.text_content,
            image_url: data.image_url,
            video_url: data.video_url || null,
            scheduled_start: null,
            scheduled_end: null,
            status: 'draft',
          });
          await refetchCampaign();
        }}
        isSaving={updatePost.isPending}
        isAdmin={isAdmin}
        platform={editingScheduledPost?.platform}
        campaignName={campaign?.name}
        practiceName={profile?.practice_name || undefined}
      />

      {/* Channels Table Dialog */}
      <Dialog open={showChannelsDialog} onOpenChange={setShowChannelsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedChannelType && channelLabels[selectedChannelType]} Channels
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Posts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getFilteredChannels().map((channel) => (
                <TableRow 
                  key={channel.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => {
                    setShowChannelsDialog(false);
                    navigate(`/campaign/${id}/channel/${channel.id}`);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${platformColors[channel.platform]}`}>
                        <div className="w-5 h-5">
                          {platformIcons[channel.platform]}
                        </div>
                      </div>
                      <span className="font-medium">{platformLabels[channel.platform]}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(channel as any).channel_posts?.length || 0} posts
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveChannel(channel.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Add Channel Dialog */}
      <Dialog open={showAddChannelDialog} onOpenChange={setShowAddChannelDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {channelTypes.map(({ type, label }) => {
              const platforms = getPlatformsByChannel(type);
              const existingPlatforms = new Set(
                campaign.campaign_channels
                  .filter(c => c.channel_type === type)
                  .map(c => c.platform)
              );
              const availablePlatforms = platforms.filter(p => !existingPlatforms.has(p));
              
              if (availablePlatforms.length === 0) return null;
              
              return (
                <div key={type}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">{label}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {availablePlatforms.map((platform) => (
                      <Button
                        key={platform}
                        variant="outline"
                        className="justify-start gap-3 h-12"
                        onClick={() => handleAddPlatform(platform)}
                        disabled={addChannel.isPending}
                      >
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${platformColors[platform]}`}>
                          <div className="w-4 h-4">
                            {platformIcons[platform]}
                          </div>
                        </div>
                        {platformLabels[platform]}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {/* Add New Channel Option */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Other</h3>
              <Button
                variant="outline"
                className="justify-start gap-3 h-12 w-full border-dashed"
                onClick={() => {
                  setShowAddChannelDialog(false);
                  setShowCustomChannelModal(true);
                }}
              >
                <div className={`w-8 h-8 rounded flex items-center justify-center ${platformColors.custom}`}>
                  <div className="w-4 h-4">
                    {platformIcons.custom}
                  </div>
                </div>
                {platformLabels.custom}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Channel Modal */}
      <ChannelCredentialModal
        open={showCustomChannelModal}
        onOpenChange={(open) => {
          setShowCustomChannelModal(open);
          if (!open) {
            setEditingCredential(null);
            setPrefillPlatformName(undefined);
          }
        }}
        onSubmit={handleCustomChannel}
        onDelete={handleDeleteCredential}
        editData={editingCredential}
        defaultPlatformName={prefillPlatformName}
      />

      <GeneratePracticeReportDialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        defaultPracticeName={profile?.practice_name || ''}
        defaultWebsiteUrl={profile?.website_url || ''}
      />

      <CampaignAddonDialog
        open={showAddonDialog}
        onOpenChange={setShowAddonDialog}
        addon={selectedAddon}
        onInclude={(key) => {
          if (id) {
            addAddon.mutate({ campaign_id: id, addon_type: key });
            setShowAddonDialog(false);
          }
        }}
        isIncluded={addons.some((a) => a.addon_type === selectedAddon?.key)}
        isPending={addAddon.isPending}
      />

      {/* Sticky Campaign Agent FAB (top-right) */}
      <button
        type="button"
        onClick={() => setShowAgentDialog(true)}
        aria-label="Open Campaign Agent"
        className="fixed top-20 right-4 md:right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition hover:scale-105"
      >
        <Bot className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-semibold">Campaign Agent</span>
      </button>

      <CampaignAgentDialog
        open={showAgentDialog}
        onOpenChange={setShowAgentDialog}
        campaignName={campaign?.name || ''}
        campaignId={id || ''}
        systemPrompt={systemPromptDoc?.content}
        practiceReport={(() => {
          const clientName = campaignOwnerProfile?.practice_name || campaignOwnerProfile?.email || profile?.practice_name || '';
          const header = clientName ? `CLIENT / PRACTICE: ${clientName}\nCAMPAIGN: ${campaign?.name || ''}\n\n` : '';
          return header + (practiceReportDoc?.content || '');
        })()}
        addonTypes={addons.map(a => a.addon_type)}
        budgetTotal={budget?.total_amount}
        budgetAllocations={budget?.allocations as any}
        channels={campaign.campaign_channels.map(c => ({ platform: c.platform, channel_type: c.channel_type }))}
        campaignFocus={(campaign as any)?.focus || profile?.campaign_focus || ''}
        strategyAccepted={campaign.status !== 'developing'}
        onStrategyGenerated={(strategy) => {
          if (id) {
            updateCampaign.mutateAsync({ id, strategy });
          }
          toast.success('Campaign strategy saved!');
        }}
      />

      <CampaignBudgetDialog
        open={showBudgetDialog}
        onOpenChange={setShowBudgetDialog}
        addons={addons}
        customAddons={customAddons}
        channels={(campaign?.campaign_channels || []).map((c: any) => ({
          id: c.id, platform: c.platform, channel_type: c.channel_type,
        }))}
        initialBudget={budget ? { total: budget.total_amount, allocations: budget.allocations } : undefined}
        onAccept={(b) => {
          if (id) {
            upsertBudget.mutate({ campaign_id: id, total_amount: b.total, allocations: b.allocations });
          }
        }}
      />

      <AddCustomAddonDialog
        open={showCustomAddonDialog}
        onOpenChange={setShowCustomAddonDialog}
        onAdd={(addon) => {
          // FIX #1: persist to DB with custom_label + custom_icon so it survives refresh
          if (id) {
            addAddon.mutate({
              campaign_id: id,
              addon_type: addon.key,
              custom_label: addon.label,
              custom_icon: addon.icon,
            });
          }
          toast.success(`"${addon.label}" added to add-ons`);
        }}
      />

      {/* Content Hub topic dialog */}
      <ContentHubDialog
        open={showContentHubDialog}
        onOpenChange={setShowContentHubDialog}
        campaignId={id || ''}
        existingTopic={(campaign as any)?.content_topic}
        onHubReady={async () => {
          // After hub generates blog + video, kick off platform post generation
          await updateCampaign.mutateAsync({ id: id!, status: 'scheduled' });
          toast.info('Blog & video ready — generating platform posts…', { duration: 5000 });
          await supabase.functions.invoke('generate-campaign-content', {
            body: { campaignId: id },
          });
          await refetchCampaign();
        }}
      />

      {/* Strategic Plan full-window editor */}
      <Dialog open={showStrategyDialog} onOpenChange={setShowStrategyDialog}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Campaign Strategy Report
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-6 pt-4">
            <Textarea
              id="strategy-editor-textarea"
              value={strategyDraft}
              onChange={(e) => setStrategyDraft(e.target.value)}
              placeholder="No strategy yet. Click Regenerate to have the agent draft one, or type your own here."
              className="h-full min-h-[300px] font-mono text-sm resize-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{strategyDraft.split(/\s+/).filter(Boolean).length} words</span>
              <span>{strategyDraft.length} characters</span>
            </div>
          </div>
          <div className="border-t px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 bg-card">
            <Button
              variant="ghost"
              size="sm"
              title="Edit"
              aria-label="Edit"
              onClick={() => {
                const ta = document.getElementById('strategy-editor-textarea') as HTMLTextAreaElement | null;
                ta?.focus();
              }}
            >
              <Pencil className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              title="Generate new"
              aria-label="Generate new"
              onClick={() => { setShowStrategyDialog(false); setShowAgentDialog(true); }}
            >
              <RefreshCw className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Generate new</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              title="Save as Draft"
              aria-label="Save as Draft"
              disabled={isSavingStrategy || !id}
              onClick={async () => {
                if (!id) return;
                setIsSavingStrategy(true);
                try {
                  await updateCampaign.mutateAsync({ id, strategy: strategyDraft, status: 'developing' as any });
                  toast.success('Saved as draft');
                  setShowStrategyDialog(false);
                } finally {
                  setIsSavingStrategy(false);
                }
              }}
            >
              {isSavingStrategy ? <Loader2 className="w-4 h-4 sm:mr-1 animate-spin" /> : <Save className="w-4 h-4 sm:mr-1" />}
              <span className="hidden sm:inline">Save as Draft</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              title="Delete"
              aria-label="Delete"
              disabled={isAcceptingPlan || !id || !campaign?.strategy}
              onClick={() => setShowDeleteStrategyConfirm(true)}
            >
              <Trash2 className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
            <Button
              size="sm"
              title="Accept"
              aria-label="Accept"
              disabled={isAcceptingPlan || !id || !strategyDraft.trim()}
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
              onClick={async () => {
                if (!id) return;
                await updateCampaign.mutateAsync({ id, strategy: strategyDraft, status: 'developing' as any });
                setShowStrategyDialog(false);
                await acceptPlanAndGenerate();
              }}
            >
              {isAcceptingPlan ? <Loader2 className="w-4 h-4 sm:mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 sm:mr-1" />}
              <span className="hidden sm:inline">Accept</span>
            </Button>
          </div>

        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteStrategyConfirm} onOpenChange={setShowDeleteStrategyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this strategy?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the saved Campaign Strategy Report and re-opens the Topic Suggestions agent
              so you can pick a new direction. Generated assets are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!id) return;
                await updateCampaign.mutateAsync({ id, strategy: null as any, status: 'developing' as any });
                setStrategyDraft('');
                setShowDeleteStrategyConfirm(false);
                setShowStrategyDialog(false);
                setShowAgentDialog(true);
                toast.success('Strategy cleared — pick a new topic');
              }}
            >
              Delete strategy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CampaignEditNew;
