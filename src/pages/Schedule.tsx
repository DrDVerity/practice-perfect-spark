import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CalendarDays, Clock, Link2, AlertCircle, Instagram, Facebook, Linkedin, Twitter, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCampaigns, CampaignVault } from '@/hooks/useCampaigns';
import { useProfile } from '@/hooks/useProfile';
import { format, isSameDay } from 'date-fns';
import { toast } from 'sonner';

const platformIcons = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
};

const platformColors = {
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  facebook: 'bg-blue-600',
  linkedin: 'bg-blue-700',
  twitter: 'bg-sky-500',
};

const Schedule = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { campaigns, scheduleCampaign, isLoading: campaignsLoading } = useCampaigns();
  const { hasSocialToken } = useProfile();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignVault | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [selectedTime, setSelectedTime] = useState('09:00');

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
    if (!hasSocialToken) {
      setSelectedCampaign(campaign);
      setShowConnectDialog(true);
      return;
    }
    
    setSelectedCampaign(campaign);
    setShowScheduleDialog(true);
  };

  const handleConfirmSchedule = () => {
    if (!selectedCampaign || !selectedDate) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hours, minutes, 0, 0);

    scheduleCampaign.mutate({
      id: selectedCampaign.id,
      scheduledDate,
    });

    setShowScheduleDialog(false);
    setSelectedCampaign(null);
  };

  const handleConnectSocial = () => {
    // In production, this would launch Opal Social Connector
    toast.info('Launching Social Connector...', {
      description: 'Connect your LinkedIn, Meta, and other social accounts.',
    });
    window.open('https://www.opal.dev/', '_blank');
    setShowConnectDialog(false);
  };

  const campaignsForSelectedDate = selectedDate ? getCampaignsForDate(selectedDate) : [];

  if (authLoading || campaignsLoading) {
    return (
      <div className="min-h-screen bg-hero-gradient flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hero-gradient">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
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
            Schedule your campaigns for automatic posting
          </p>
        </div>

        {/* Social Connection Status */}
        {!hasSocialToken && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Social accounts not connected</p>
              <p className="text-sm text-muted-foreground">Connect your accounts to enable automatic posting.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleConnectSocial}>
              <Link2 className="w-4 h-4 mr-2" />
              Connect Accounts
            </Button>
          </div>
        )}

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
                        const PlatformIcon = platformIcons[campaign.platform];
                        return (
                          <div
                            key={campaign.id}
                            className="p-4 rounded-xl bg-accent/50 flex items-center gap-4"
                          >
                            <Badge className={`${platformColors[campaign.platform]} text-white border-0`}>
                              <PlatformIcon className="w-3.5 h-3.5 mr-1" />
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
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Ready to Schedule
              </h2>
              
              {draftCampaigns.length > 0 ? (
                <div className="space-y-3">
                  {draftCampaigns.map((campaign) => {
                    const PlatformIcon = platformIcons[campaign.platform];
                    return (
                      <div
                        key={campaign.id}
                        className="p-4 rounded-xl bg-accent/50"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${platformColors[campaign.platform]} text-white border-0 text-xs`}>
                            <PlatformIcon className="w-3 h-3 mr-1" />
                            {campaign.platform}
                          </Badge>
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
              Choose a date and time to publish "{selectedCampaign?.title}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Date</label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
                disabled={(date) => date < new Date()}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Time</label>
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

      {/* Connect Social Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Connect Social Accounts
            </DialogTitle>
            <DialogDescription>
              To schedule automatic posts, you need to connect your social media accounts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="p-4 rounded-xl bg-accent/50 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${platformColors.facebook} flex items-center justify-center`}>
                <Facebook className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Meta (Facebook & Instagram)</p>
                <p className="text-sm text-muted-foreground">Connect your business pages</p>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-accent/50 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${platformColors.linkedin} flex items-center justify-center`}>
                <Linkedin className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">LinkedIn</p>
                <p className="text-sm text-muted-foreground">Connect your company page</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnectSocial}>
              <Link2 className="w-4 h-4 mr-2" />
              Launch Opal Social Connector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;
