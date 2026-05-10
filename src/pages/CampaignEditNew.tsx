import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { CheckCircle, ExternalLink, Globe, Loader2, Send, Clock, RefreshCw } from 'lucide-react';
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
  const { user, isAdmin, isManager } = useAuth();
  const { useCampaignWithChannels, addChannel, removeChannel, updateCampaign, addPost, updatePost, deletePost } = useCampaignsNew();
  const { data: campaign, isLoading, refetch: refetchCampaign } = useCampaignWithChannels(id);

  // Fetch the campaign owner's profile (full, for focus editing + admin view)
  const queryClient = (useQuery as any); // keep types loose
  const { data: campaignOwnerProfile, refetch: refetchOwnerProfile } = useQuery({
    queryKey: ['campaign-owner-profile-full', campaign?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('practice_name, email, campaign_focus, user_id')
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
  const [selectedAddon, setSelectedAddon] = useState<AddonInfo | null>(null);
  const [showAddonDialog, setShowAddonDialog] = useState(false);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [showCustomAddonDialog, setShowCustomAddonDialog] = useState(false);
  const [customAddons, setCustomAddons] = useState<AddonInfo[]>([]);
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
  const [isSavingFocus, setIsSavingFocus] = useState(false);
  const [editLandingUrl, setEditLandingUrl] = useState('');
  const [isSavingLanding, setIsSavingLanding] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingScheduledPost, setEditingScheduledPost] = useState<{ post: ChannelPost; channelId: string; platform: PlatformType } | null>(null);

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
      const { error } = await supabase
        .from('profiles')
        .update({ campaign_focus: editFocus })
        .eq('user_id', campaign.user_id);
      if (error) throw error;
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
      // Ensure at least the default set of channels exists
      await ensureDefaultChannels();
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
    // Validate: must have a date window, at least one channel, every channel has posts, every post is scheduled within window.
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
      // Mark every post as scheduled (if still draft) and the campaign as active.
      for (const ch of channels) {
        const posts = (ch as any).channel_posts || [];
        for (const p of posts) {
          if (p.status !== 'scheduled' && p.status !== 'published') {
            await updatePost.mutateAsync({ id: p.id, channelId: ch.id, status: 'scheduled' });
          }
        }
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

        {/* Campaign Focus Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Campaign Focus</h2>
            {!isEditingFocus && (
              <Button variant="outline" size="sm" onClick={() => {
                setEditFocus(campaignOwnerProfile?.campaign_focus || '');
                setIsEditingFocus(true);
              }}>
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-6">
              {isEditingFocus ? (
                <div className="space-y-3">
                  <Textarea
                    value={editFocus}
                    onChange={(e) => setEditFocus(e.target.value)}
                    placeholder="Describe what this campaign is focused on (offer, audience, goals)…"
                    className="min-h-[120px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={isSavingFocus} onClick={saveFocus}>
                      {isSavingFocus ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                      Save Focus
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingFocus(false)}>Cancel</Button>
                  </div>
                </div>
              ) : campaignOwnerProfile?.campaign_focus ? (
                <p className="text-foreground whitespace-pre-wrap">{campaignOwnerProfile.campaign_focus}</p>
              ) : (
                <p className="text-muted-foreground italic">No campaign focus set yet. Click Edit to add one.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Posting Schedule Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Posting Schedule
              {sortedPosts.length > 0 && (
                <Badge variant="outline" className="ml-2">{sortedPosts.length} posts</Badge>
              )}
            </h2>
            <PublishButton size="sm" />
          </div>
          {sortedPosts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                No posts scheduled yet. Accept the campaign strategy below to auto-generate posts,
                ad copy, email sequences, and images for every channel.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPosts.map(({ post, channelId, platform }) => (
                      <TableRow
                        key={post.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => setEditingScheduledPost({ post, channelId, platform })}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded flex items-center justify-center ${platformColors[platform]}`}>
                              <div className="w-4 h-4">{platformIcons[platform]}</div>
                            </div>
                            <span className="text-xs font-medium">{platformLabels[platform]}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium max-w-xs truncate">
                          {post.title || 'Untitled'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {post.scheduled_start
                            ? format(new Date(post.scheduled_start), 'MMM d, yyyy h:mm a')
                            : <span className="text-amber-600">Unscheduled</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{post.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Landing Page URL Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Landing Page</h2>
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
          <Card>
            <CardContent className="p-6 space-y-3">
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
              {(campaign as any)?.landing_page_url && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Current:</span>
                  <a
                    href={(campaign as any).landing_page_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 break-all"
                  >
                    {(campaign as any).landing_page_url} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Campaign Strategy Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-foreground">Campaign Strategy</h2>
            <div className="flex items-center gap-2">
              {campaign.strategy && (() => {
                const isAccepted = campaign.status !== 'developing' && !isEditingStrategy;
                return (
                  <Button
                    size="sm"
                    disabled={isAcceptingPlan || isAccepted}
                    className={
                      isAccepted
                        ? 'bg-muted text-muted-foreground cursor-not-allowed font-bold'
                        : 'bg-red-600 hover:bg-red-700 text-white font-bold'
                    }
                    title={isAccepted ? 'Strategy already accepted — edit or regenerate to re-accept' : 'Accept plan and generate assets'}
                    onClick={async () => {
                      if (!id || isAccepted) return;
                      if (isEditingStrategy) {
                        await updateCampaign.mutateAsync({ id, strategy: editStrategy });
                        setIsEditingStrategy(false);
                      }
                      await acceptPlanAndGenerate();
                    }}
                  >
                    {isAcceptingPlan ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                    {isAccepted ? 'Accepted' : 'Accept'}
                  </Button>
                );
              })()}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAgentDialog(true)}
              >
                <Bot className="w-4 h-4 mr-1" />
                {campaign.strategy ? 'Regenerate Strategy' : 'Generate Strategy'}
              </Button>
            </div>
          </div>
          {campaign.strategy ? (
            <Card>
              <CardContent className="p-6">
                {isEditingStrategy ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editStrategy}
                      onChange={(e) => setEditStrategy(e.target.value)}
                      className="min-h-[300px] font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={isAcceptingPlan}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold"
                        onClick={async () => {
                          if (!id) return;
                          await updateCampaign.mutateAsync({ id, strategy: editStrategy, status: 'developing' as any });
                          setIsEditingStrategy(false);
                          await acceptPlanAndGenerate();
                        }}
                      >
                        {isAcceptingPlan ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={async () => {
                        if (id) await updateCampaign.mutateAsync({ id, strategy: editStrategy, status: 'developing' as any });
                        setIsEditingStrategy(false);
                      }}>Save Draft</Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingStrategy(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none cursor-pointer group pr-4"
                      onClick={() => { setEditStrategy(campaign.strategy || ''); setIsEditingStrategy(true); }}
                      title="Click to edit strategy"
                    >
                      <ReactMarkdown>{campaign.strategy}</ReactMarkdown>
                      <p className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-2">Click to edit</p>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
              {!isEditingStrategy && campaign.status === 'developing' && (
                <div className="px-6 pb-4 text-xs text-muted-foreground">
                  Review the plan above. When ready, click the red <span className="font-semibold text-red-600">Accept</span> button at the top of this section to generate the campaign assets.
                </div>
              )}
              {(campaign as any).landing_page_url && (
                <div className="px-6 pb-4 flex items-center gap-2 text-sm">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Landing page:</span>
                  <a
                    href={(campaign as any).landing_page_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Bot className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-3">No campaign strategy yet. Use the AI agent to generate one.</p>
                <Button onClick={() => setShowAgentDialog(true)}>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Generate Strategy
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Channels Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Channels</h2>
            <Button onClick={() => setShowAddChannelDialog(true)}>
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
                    if (count > 0) {
                      setShowChannelsDialog(true);
                    } else {
                      setShowAddChannelDialog(true);
                    }
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {icon}
                      </div>
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground mb-1">{count}</div>
                    <p className="text-sm text-muted-foreground">
                      {count === 0 ? 'Tap to add a platform' : count === 1 ? 'platform' : 'platforms'} {count > 0 ? 'connected' : ''}
                    </p>
                    {count > 0 && (
                      <div className="flex gap-1 mt-3">
                        {channels.slice(0, 4).map((channel) => (
                          <div 
                            key={channel.id}
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${platformColors[channel.platform]}`}
                          >
                            <div className="w-4 h-4">
                              {platformIcons[channel.platform]}
                            </div>
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
        </div>

        {/* Saved Credentials Section */}
        {credentials.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Platform Credentials</h2>
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

        {/* Campaign Add-Ons Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Campaign Add-Ons</h2>
            {budget && budget.total_amount > 0 && (
              <Badge className="bg-green-500 text-white hover:bg-green-600 ml-2 text-sm px-2.5 py-0.5">
                ${budget.total_amount.toLocaleString()}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Expand your campaign with additional marketing channels and strategies
            </p>
            <div className="flex gap-2">
              {(isAdmin || isManager) && (
                <Button variant="outline" size="sm" onClick={() => setShowCustomAddonDialog(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Vector
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowBudgetDialog(true)}>
                <DollarSign className="w-4 h-4 mr-1" />
                Budget
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[...CAMPAIGN_ADDONS, ...customAddons].map((addon) => {
              const isIncluded = addons.some((a) => a.addon_type === addon.key);
              return (
                <Card
                  key={addon.key}
                  className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                    isIncluded ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    setSelectedAddon(addon);
                    setShowAddonDialog(true);
                  }}
                >
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
          {addons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {addons.map((a) => {
                const allDefs = [...CAMPAIGN_ADDONS, ...customAddons];
                const info = allDefs.find((ad) => ad.key === a.addon_type);
                return (
                  <Badge key={a.id} variant="outline" className="gap-1">
                    {info?.icon} {info?.label || a.addon_type}
                    <button
                      className="ml-1 hover:text-destructive"
                      onClick={() => removeAddon.mutate(a.id)}
                    >
                      ×
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Campaign Schedule (Gantt) — clickable to open full schedule */}
        {campaign.start_date && campaign.end_date && (
          <div className="mb-8">
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/schedule?campaign=${id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/schedule?campaign=${id}`); }}
              className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/40 rounded-lg"
              title="Click to open and edit the full schedule"
            >
              <CampaignGanttChart
                campaignStart={new Date(campaign.start_date)}
                campaignEnd={new Date(campaign.end_date)}
                channels={campaign.campaign_channels as any}
                addons={addons}
                budgetAllocations={budget?.allocations as any}
              />
            </div>
          </div>
        )}

        {/* Campaign Dashboard */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Campaign Dashboard</h2>
          <CampaignDashboardSection
            channels={campaign.campaign_channels as any}
            addons={addons}
            budget={budget}
            customAddons={customAddons}
            credentials={credentials}
            onBudgetClick={() => setShowBudgetDialog(true)}
            onChannelClick={(channelId) => navigate(`/campaign/${id}/channel/${channelId}`)}
            onAddCredential={(platformName) => {
              setEditingCredential(null);
              setPrefillPlatformName(platformName);
              setShowCustomChannelModal(true);
            }}
            onAddonClick={(addonType) => {
              const def = [...CAMPAIGN_ADDONS, ...customAddons].find((a) => a.key === addonType);
              if (def) {
                setSelectedAddon(def);
                setShowAddonDialog(true);
              }
            }}
          />
        </div>

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
        campaignFocus={profile?.campaign_focus || ''}
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
          setCustomAddons((prev) => [...prev, addon]);
          toast.success(`"${addon.label}" added to add-ons`);
        }}
      />
    </div>
  );
};

export default CampaignEditNew;
