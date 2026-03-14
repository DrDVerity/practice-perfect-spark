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
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  const { user } = useAuth();
  const { useCampaignWithChannels, addChannel, removeChannel, updateCampaign } = useCampaignsNew();
  const { data: campaign, isLoading } = useCampaignWithChannels(id);
  
  const [showChannelsDialog, setShowChannelsDialog] = useState(false);
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType | null>(null);
  const [showAddChannelDialog, setShowAddChannelDialog] = useState(false);
  const [showCustomChannelModal, setShowCustomChannelModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState<CredentialEditData | null>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const { credentials, addCredential, updateCredential, deleteCredential } = useChannelCredentials();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary/50 flex items-center justify-center">
        <div className="animate-pulse text-primary-foreground">Loading...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-primary/50 flex items-center justify-center">
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
    <div className="min-h-screen bg-primary/50">
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {campaign.name}
          </h1>
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
    </div>
  );
};

export default CampaignEditNew;
