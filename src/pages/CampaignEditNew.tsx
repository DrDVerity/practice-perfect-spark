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
import { CheckCircle } from 'lucide-react';

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
  const { useCampaignWithChannels, addChannel, removeChannel, updateCampaign } = useCampaignsNew();
  const { data: campaign, isLoading } = useCampaignWithChannels(id);

  // Fetch the campaign owner's profile for admin/manager view
  const { data: campaignOwnerProfile } = useQuery({
    queryKey: ['campaign-owner-profile', campaign?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('practice_name, email')
        .eq('user_id', campaign!.user_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: (isAdmin || isManager) && !!campaign?.user_id && campaign?.user_id !== user?.id,
  });
  
  const [showChannelsDialog, setShowChannelsDialog] = useState(false);
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType | null>(null);
  const [showAddChannelDialog, setShowAddChannelDialog] = useState(false);
  const [showCustomChannelModal, setShowCustomChannelModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState<CredentialEditData | null>(null);
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
  // Smart report: check if a market_analysis report exists within 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const hasRecentReport = kbDocs.some(
    (d) => d.doc_type === 'market_analysis' && new Date(d.updated_at) > sixMonthsAgo
  );

  // Get system prompt and practice report for campaign agent
  const systemPromptDoc = kbDocs.find((d) => d.doc_type === 'system_prompt');
  const practiceReportDoc = kbDocs.find((d) => d.doc_type === 'market_analysis');

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

  const getFilteredChannels = () => {
    if (!selectedChannelType) return campaign.campaign_channels;
    return channelsByType[selectedChannelType] || [];
  };

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
            <Button variant="outline" size="sm" onClick={() => setShowAgentDialog(true)}>
              <Bot className="w-4 h-4 mr-1" />
              Campaign Agent
            </Button>
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {credentials.map((cred) => (
                <Card key={cred.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{cred.platform_name}</p>
                      {cred.username && (
                        <p className="text-sm text-muted-foreground truncate">@{cred.username}</p>
                      )}
                      {cred.platform_url && (
                        <p className="text-xs text-muted-foreground truncate">{cred.platform_url}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditCredential(cred)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
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

        {/* Campaign Strategy Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Campaign Strategy</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAgentDialog(true)}
            >
              <Bot className="w-4 h-4 mr-1" />
              {campaign.strategy ? 'Regenerate Strategy' : 'Generate Strategy'}
            </Button>
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
                      <Button size="sm" onClick={() => {
                        if (id) {
                          updateCampaign.mutateAsync({ id, strategy: editStrategy });
                        }
                        setIsEditingStrategy(false);
                      }}>Save</Button>
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
                <div className="px-6 pb-4">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={async () => {
                      if (!id) return;
                      await updateCampaign.mutateAsync({ id, status: 'scheduled' });
                      toast.success('Campaign plan accepted! Status set to Scheduled.');
                    }}
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Accept Plan
                  </Button>
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

        {/* Campaign Schedule (Gantt Chart) */}
        {campaign.start_date && campaign.end_date && (
          <div className="mb-8">
            <CampaignGanttChart
              campaignStart={new Date(campaign.start_date)}
              campaignEnd={new Date(campaign.end_date)}
              channels={campaign.campaign_channels as any}
              addons={addons}
              budgetAllocations={budget?.allocations as any}
            />
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
          />
        </div>
      </main>

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
          if (!open) setEditingCredential(null);
        }}
        onSubmit={handleCustomChannel}
        onDelete={handleDeleteCredential}
        editData={editingCredential}
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
        practiceReport={practiceReportDoc?.content}
        addonTypes={addons.map(a => a.addon_type)}
        budgetTotal={budget?.total_amount}
        budgetAllocations={budget?.allocations as any}
        channels={campaign.campaign_channels.map(c => ({ platform: c.platform, channel_type: c.channel_type }))}
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
