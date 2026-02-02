import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CampaignCard } from '@/components/campaign/CampaignCard';
import { useAuth } from '@/hooks/useAuth';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useProfile } from '@/hooks/useProfile';
import { LogOut, CalendarDays, Plus, Shield, User, Sparkles } from 'lucide-react';
import { Campaign } from '@/types/campaign';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, signOut, isLoading: authLoading } = useAuth();
  const { campaigns, isLoading: campaignsLoading } = useCampaigns();
  const { profile } = useProfile();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleDownload = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign?.image_url) {
      // Create a link to download the image
      const link = document.createElement('a');
      link.href = campaign.image_url;
      link.download = `${campaign.title.replace(/\s+/g, '-')}.jpg`;
      link.click();
    }
  };

  const handleEdit = (campaignId: string) => {
    navigate(`/campaign/edit/${campaignId}`);
  };

  const handleSchedule = (campaignId: string) => {
    navigate('/schedule');
  };

  // Convert database campaigns to Campaign type for CampaignCard
  const campaignCards: Campaign[] = campaigns.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description || '',
    imageUrl: c.image_url || '',
    videoUrl: c.video_url || undefined,
    textCopy: c.text_copy || '',
    platform: c.platform,
    status: c.status,
    scheduledDate: c.scheduled_date ? new Date(c.scheduled_date) : undefined,
  }));

  if (authLoading) {
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{user?.email}</span>
              {isAdmin && (
                <Badge className="bg-primary text-primary-foreground gap-1">
                  <Shield className="w-3 h-3" />
                  Admin
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-8 md:py-16">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Welcome back{profile?.practice_name ? `, ${profile.practice_name}` : ''}!
            </h1>
            <p className="text-muted-foreground">
              Manage your campaigns and schedule posts
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/schedule')}>
              <CalendarDays className="w-4 h-4 mr-2" />
              Posting Calendar
            </Button>
            <Button onClick={() => navigate('/')}>
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Total Campaigns</p>
            <p className="text-2xl font-bold text-foreground">{campaigns.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Drafts</p>
            <p className="text-2xl font-bold text-foreground">
              {campaigns.filter(c => c.status === 'draft').length}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Scheduled</p>
            <p className="text-2xl font-bold text-foreground">
              {campaigns.filter(c => c.status === 'scheduled').length}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground">Published</p>
            <p className="text-2xl font-bold text-foreground">
              {campaigns.filter(c => c.status === 'published').length}
            </p>
          </div>
        </div>

        {/* Campaigns */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Your Campaigns
          </h2>
        </div>

        {campaignsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border animate-pulse">
                <div className="aspect-video bg-muted rounded-xl mb-4" />
                <div className="h-6 bg-muted rounded mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : campaigns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaignCards.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onDownload={() => handleDownload(campaign.id)}
                onEdit={() => handleEdit(campaign.id)}
                onSchedule={() => handleSchedule(campaign.id)}
                isLocked={false}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first AI-powered marketing campaign
            </p>
            <Button onClick={() => navigate('/')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
