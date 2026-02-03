import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CampaignsTable } from '@/components/dashboard/CampaignsTable';
import { CreateCampaignDialog } from '@/components/dashboard/CreateCampaignDialog';
import { useAuth } from '@/hooks/useAuth';
import { useCampaignsNew } from '@/hooks/useCampaignsNew';
import { useProfile } from '@/hooks/useProfile';
import { LogOut, CalendarDays, Plus, Shield, User } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, signOut, isLoading: authLoading } = useAuth();
  const { campaigns, isLoading: campaignsLoading, createCampaign } = useCampaignsNew();
  const { profile } = useProfile();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleCreateCampaign = async (data: { name: string; start_date: string | null; end_date: string | null }) => {
    const result = await createCampaign.mutateAsync({
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
      status: 'developing',
    });
    
    setShowCreateDialog(false);
    
    // Navigate to the new campaign
    if (result?.id) {
      navigate(`/campaign/${result.id}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-primary/50 flex items-center justify-center">
        <div className="animate-pulse text-primary-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary/50">
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
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Welcome back{profile?.practice_name ? `, ${profile.practice_name}` : ''}!
            </h1>
            <p className="text-primary">
              Manage your marketing campaigns
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/schedule')}>
              <CalendarDays className="w-4 h-4 mr-2" />
              Posting Calendar
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            All Campaigns
          </h2>
          <CampaignsTable
            campaigns={campaigns}
            isLoading={campaignsLoading}
            onCreateCampaign={() => setShowCreateDialog(true)}
          />
        </div>
      </main>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateCampaign}
        isLoading={createCampaign.isPending}
      />
    </div>
  );
};

export default Dashboard;
