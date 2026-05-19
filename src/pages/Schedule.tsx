import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CampaignScheduler from '@/components/campaign/CampaignScheduler';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CalendarDays, Clock, Link2, AlertCircle, Check, Plus, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCampaigns, CampaignVault } from '@/hooks/useCampaigns';
import { useProfile } from '@/hooks/useProfile';
import { useChannelCredentials, ChannelCredential } from '@/hooks/useChannelCredentials';
import ChannelCredentialModal, { CredentialEditData } from '@/components/channel/ChannelCredentialModal';
import PlatformCredentialCards from '@/components/channel/PlatformCredentialCards';
import { useBundleSocial } from '@/hooks/useBundleSocial';
// FIX #5: Use canonical platform maps — no local redeclarations
import {
  platformIcons as _allIcons,
  platformColors,
  platformLabels,
} from '@/lib/platformIcons';
import { format, isSameDay } from 'date-fns';
import { toast } from 'sonner';

// Wrap to match the React.ComponentType signature Schedule.tsx expects
const platformIcons: Record<string, React.ComponentType<{ className?: string }>> =
  Object.fromEntries(
    Object.entries(_allIcons).map(([k, v]) => [k, () => v as React.ReactElement])
  );

const Schedule = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const campaignParam = searchParams.get('campaign');
  const { user, isLoading: authLoading } = useAuth();
  const { campaigns, scheduleCampaign, deleteCampaign, isLoading: campaignsLoading } = useCampaigns();
  const { hasSocialToken } = useProfile();
  const { credentials, addCredential, updateCredential, deleteCredential } = useChannelCredentials();
  const { publishPost } = useBundleSocial();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignVault | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [selectedChannelForPost, setSelectedChannelForPost] = useState<string>('');

  // Credential modal state
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState<CredentialEditData | null>(null);
  const [pendingScheduleCampaign, setPendingScheduleCampaign] = useState<CampaignVault | null>(null);
  const [prefillPlatformName, setPrefillPlatformName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled' && c.scheduled_date);
  const draftCampaigns = campaigns.filter(c => c.status === 'draft');

  const getCampaignsForDate = (date: Date) => {
    return scheduledCampaigns.filter(c =>
      c.scheduled_date && isSameDay(new Date(c.scheduled_date), date)
    );
  };

  const handleScheduleClick = (campaign: CampaignVault) => {
    const platform = campaign.platform?.toLowerCase() || '';
    const hasCredential = credentials.some(
      (c) => c.platform_name.toLowerCase() === platform
    );

    if (!hasCredential && !hasSocialToken) {
      // Open credential modal pre-filled with platform
      setPendingScheduleCampaign(campaign);
      setEditingCredential(null);
      setShowCredentialModal(true);
      return;
    }

    setSelectedCampaign(campaign);
    setShowScheduleDialog(true);
  };

  const handleCredentialSubmit = (creds: { platformName: string; platformUrl: string; username: string; password: string }) => {
    if (editingCredential) {
      updateCredential.mutate({
        id: editingCredential.id,
        platform_name: creds.platformName,
        platform_url: creds.platformUrl || null,
        username: creds.username || null,
        password: creds.password || null,
      }, {
        onSuccess: () => {
          setShowCredentialModal(false);
          setEditingCredential(null);
        }
      });
    } else {
      addCredential.mutate({
        platform_name: creds.platformName,
        platform_url: creds.platformUrl || undefined,
        username: creds.username || undefined,
        password: creds.password || undefined,
      }, {
        onSuccess: () => {
          setShowCredentialModal(false);
          // If there was a pending campaign, proceed to schedule
          if (pendingScheduleCampaign) {
            setSelectedCampaign(pendingScheduleCampaign);
            setPendingScheduleCampaign(null);
            setShowScheduleDialog(true);
          }
        }
      });
    }
  };

  const handleCredentialDelete = (id: string) => {
    deleteCredential.mutate(id, {
      onSuccess: () => {
        setShowCredentialModal(false);
        setEditingCredential(null);
      }
    });
  };

  const handleEditCredential = (cred: ChannelCredential) => {
    setEditingCredential({
      id: cred.id,
      platform_name: cred.platform_name,
      platform_url: cred.platform_url,
      username: cred.username,
      password: cred.password,
    });
    setShowCredentialModal(true);
  };

  const handleConfirmSchedule = () => {
    if (!selectedCampaign || !selectedDate) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hours, minutes, 0, 0);

    scheduleCampaign.mutate(
      { id: selectedCampaign.id, scheduledDate },
      {
        onSuccess: () => {
          // If the scheduled time is now or in the past, publish immediately
          if (scheduledDate <= new Date()) {
            // The campaign_vault model doesn't have direct channel_posts links,
            // so immediate publishing is handled by the cron sweep within the minute.
            toast.info('Post scheduled for immediate publish — will go live within 1 minute.');
          }
        },
      }
    );

    setShowScheduleDialog(false);
    setSelectedCampaign(null);
  };

  const handleRemoveDraft = (campaign: CampaignVault) => {
    deleteCampaign.mutate(campaign.id);
  };

  const handleRemoveAllDrafts = () => {
    if (draftCampaigns.length === 0) return;
    draftCampaigns.forEach((c) => deleteCampaign.mutate(c.id));
    toast.success('All draft campaigns removed');
  };

  const campaignsForSelectedDate = selectedDate ? getCampaignsForDate(selectedDate) : [];

  if (authLoading || campaignsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-white/50 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <Logo />
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-8 md:py-16">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-primary" />
            Posting Calendar
          </h1>
          <p className="text-muted-foreground">
            Schedule your campaigns for automatic posting across all connected channels
          </p>
        </div>

        {/* Campaign-specific scheduler */}
        {campaignParam && (
          <CampaignScheduler campaignId={campaignParam} />
        )}

        {/* Social Connection Status */}
        {!hasSocialToken && credentials.length === 0 && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Social accounts not connected</p>
              <p className="text-sm text-muted-foreground">Connect your accounts to enable automatic posting.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setEditingCredential(null); setShowCredentialModal(true); }}>
              <Link2 className="w-4 h-4 mr-2" />
              Connect Accounts
            </Button>
          </div>
        )}

        {/* Connected Channels */}
        <div className="mb-6 p-6 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Connected Channels
            </h2>
            <Button size="sm" onClick={() => { setEditingCredential(null); setPendingScheduleCampaign(null); setShowCredentialModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Channel
            </Button>
          </div>

          {credentials.length > 0 ? (
            <PlatformCredentialCards
              credentials={credentials}
              variant="pill"
              onEdit={(cred) => { setEditingCredential(cred); setShowCredentialModal(true); }}
              onAddAnother={(platformName) => {
                setEditingCredential(null);
                setPrefillPlatformName(platformName);
                setShowCredentialModal(true);
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No channels connected yet. Add a channel to start scheduling posts.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="p-6 rounded-2xl bg-card border border-border">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="w-full"
                modifiers={{
                  scheduled: scheduledCampaigns
                    .filter(c => c.scheduled_date)
                    .map(c => new Date(c.scheduled_date!)),
                }}
                modifiersClassNames={{
                  scheduled: 'bg-primary/20 text-primary font-semibold',
                }}
              />

              {/* Selected Date Details */}
              {selectedDate && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="font-semibold text-foreground mb-4">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </h3>

                  {campaignsForSelectedDate.length > 0 ? (
                    <div className="space-y-3">
                      {campaignsForSelectedDate.map((campaign) => {
                        const platformKey = campaign.platform?.toLowerCase() || '';
                        const PlatformIcon = platformIcons[platformKey];
                        return (
                          <div
                            key={campaign.id}
                            className="p-4 rounded-xl bg-accent/50 flex items-center gap-4"
                          >
                            <Badge className={`${platformColors[platformKey] || 'bg-muted'} text-white border-0`}>
                              {PlatformIcon && <PlatformIcon className="w-3.5 h-3.5 mr-1" />}
                              {campaign.platform}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{campaign.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {campaign.scheduled_date && format(new Date(campaign.scheduled_date), 'h:mm a')}
                              </p>
                            </div>
                            <Badge variant="outline" className="gap-1">
                              <Check className="w-3 h-3" />
                              Scheduled
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No campaigns scheduled for this date.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Draft Campaigns */}
          <div>
            <div className="p-6 rounded-2xl bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Ready to Schedule
                </h2>
                {draftCampaigns.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={handleRemoveAllDrafts}
                    title="Remove all drafts"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {draftCampaigns.length > 0 ? (
                <div className="space-y-3">
                  {draftCampaigns.map((campaign) => {
                    const platformKey = campaign.platform?.toLowerCase() || '';
                    const PlatformIcon = platformIcons[platformKey];
                    return (
                      <div
                        key={campaign.id}
                        className="p-4 rounded-xl bg-accent/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={`${platformColors[platformKey] || 'bg-muted'} text-white border-0 text-xs`}>
                            {PlatformIcon && <PlatformIcon className="w-3 h-3 mr-1" />}
                            {campaign.platform}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => navigate(`/campaign/${campaign.id}`)}
                              title="Edit campaign"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveDraft(campaign)}
                              title="Remove from schedule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="font-medium text-foreground text-sm mb-3 line-clamp-2">
                          {campaign.title}
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleScheduleClick(campaign)}
                        >
                          <CalendarDays className="w-4 h-4 mr-2" />
                          Schedule
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No draft campaigns available. Create campaigns first!
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Campaign</DialogTitle>
            <DialogDescription>
              Choose a date, time, and channel to publish "{selectedCampaign?.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {credentials.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">Channel</Label>
                <Select value={selectedChannelForPost} onValueChange={setSelectedChannelForPost}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {credentials.map((cred) => (
                      <SelectItem key={cred.id} value={cred.id}>
                        {platformLabels[cred.platform_name.toLowerCase()] || cred.platform_name} - {cred.username || cred.platform_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">Date</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
                disabled={(date) => date < new Date()}
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">Time</Label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['06:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map((time) => (
                    <SelectItem key={time} value={time}>
                      {format(new Date(`2000-01-01T${time}`), 'h:mm a')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSchedule} disabled={scheduleCampaign.isPending}>
              {scheduleCampaign.isPending ? 'Scheduling...' : 'Confirm Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Credential Modal */}
      <ChannelCredentialModal
        open={showCredentialModal}
        onOpenChange={(o) => {
          setShowCredentialModal(o);
          if (!o) setPrefillPlatformName(undefined);
        }}
        onSubmit={handleCredentialSubmit}
        onDelete={handleCredentialDelete}
        editData={editingCredential}
        defaultPlatformName={prefillPlatformName}
      />
    </div>
  );
};

export default Schedule;
