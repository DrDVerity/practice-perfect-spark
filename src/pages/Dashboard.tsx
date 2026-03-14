import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CampaignsTable } from '@/components/dashboard/CampaignsTable';
import { CreateCampaignDialog } from '@/components/dashboard/CreateCampaignDialog';
import { useAuth } from '@/hooks/useAuth';
import { useCampaignsNew } from '@/hooks/useCampaignsNew';
import { useProfile } from '@/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, CalendarDays, Plus, Shield, User, BookOpen, FileSearch, ArrowLeft, Pencil } from 'lucide-react';
import GeneratePracticeReportDialog from '@/components/dashboard/GeneratePracticeReportDialog';
import EditClientDialog from '@/components/admin/EditClientDialog';

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');
  const { user, isAdmin, signOut, isLoading: authLoading } = useAuth();
  const { campaigns, isLoading: campaignsLoading, createCampaign } = useCampaignsNew();
  const { profile } = useProfile();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);

  // When admin views a specific client's dashboard
  const isViewingClient = isAdmin && !!clientId;

  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', clientId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isViewingClient,
  });

  const { data: clientCampaigns = [], isLoading: clientCampaignsLoading } = useQuery({
    queryKey: ['client-campaigns', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isViewingClient,
  });

  const displayCampaigns = isViewingClient ? clientCampaigns : campaigns;
  const displayLoading = isViewingClient ? clientCampaignsLoading : campaignsLoading;
  const displayName = isViewingClient
    ? clientProfile?.practice_name || clientProfile?.email || 'Client'
    : profile?.practice_name;

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
          <div className="flex items-center gap-3">
            {isViewingClient && (
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {isViewingClient
                  ? `${displayName}'s Dashboard`
                  : `Welcome back${displayName ? `, ${displayName}` : ''}!`}
              </h1>
              <p className="text-primary">
                {isViewingClient ? 'Viewing as admin' : 'Manage your marketing campaigns'}
              </p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {isViewingClient && (
              <Button variant="outline" onClick={() => setShowEditClient(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Account
              </Button>
            )}
            {isAdmin && !isViewingClient && (
              <Button variant="outline" onClick={() => navigate('/admin')}>
                <Shield className="w-4 h-4 mr-2" />
                Admin Dashboard
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowReportDialog(true)}>
              <FileSearch className="w-4 h-4 mr-2" />
              Practice Report
            </Button>
            <Button variant="outline" onClick={() => navigate('/knowledge-base')}>
              <BookOpen className="w-4 h-4 mr-2" />
              Knowledge Base
            </Button>
            <Button variant="outline" onClick={() => navigate('/schedule')}>
              <CalendarDays className="w-4 h-4 mr-2" />
              Posting Calendar
            </Button>
            {!isViewingClient && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            )}
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            All Campaigns
          </h2>
          <CampaignsTable
            campaigns={displayCampaigns}
            isLoading={displayLoading}
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

      <GeneratePracticeReportDialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        defaultPracticeName={profile?.practice_name || ''}
        defaultWebsiteUrl={profile?.website_url || ''}
      />
    </div>
  );
};

export default Dashboard;
