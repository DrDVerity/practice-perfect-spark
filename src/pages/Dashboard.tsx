import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CampaignsTable } from '@/components/dashboard/CampaignsTable';
import { CreateCampaignDialog } from '@/components/dashboard/CreateCampaignDialog';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useCampaignsNew } from '@/hooks/useCampaignsNew';
import { useProfile } from '@/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, CalendarDays, Plus, Shield, User, BookOpen, FileSearch, ArrowLeft, Pencil, Users } from 'lucide-react';
import GeneratePracticeReportDialog from '@/components/dashboard/GeneratePracticeReportDialog';
import EditClientDialog from '@/components/admin/EditClientDialog';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const legacyClientId = searchParams.get('clientId');
  const { user, isAdmin, isManager, managedClientIds, signOut, isLoading: authLoading } = useAuth();
  const { startImpersonation, impersonatedUserId } = useImpersonation();

  // Promote legacy ?clientId= URLs into a full impersonation session.
  useEffect(() => {
    if (legacyClientId && (isAdmin || isManager) && legacyClientId !== impersonatedUserId) {
      startImpersonation(legacyClientId);
      const next = new URLSearchParams(searchParams);
      next.delete('clientId');
      setSearchParams(next, { replace: true });
    }
  }, [legacyClientId, isAdmin, isManager, impersonatedUserId, startImpersonation, searchParams, setSearchParams]);

  const clientId = impersonatedUserId || legacyClientId;
  const { campaigns, isLoading: campaignsLoading, createCampaign } = useCampaignsNew();
  const { profile } = useProfile();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);

  // When admin views a specific client's dashboard
  const isViewingClient = (isAdmin || isManager) && !!clientId;

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

  const cloneCampaignAssets = async (sourceId: string, targetId: string) => {
    const { data: srcChannels } = await supabase
      .from('campaign_channels')
      .select('channel_type, platform')
      .eq('campaign_id', sourceId);
    if (srcChannels && srcChannels.length) {
      await supabase.from('campaign_channels').insert(
        srcChannels.map((c: any) => ({ ...c, campaign_id: targetId }))
      );
    }
    const { data: srcAddons } = await supabase
      .from('campaign_addons')
      .select('addon_type, notes')
      .eq('campaign_id', sourceId);
    if (srcAddons && srcAddons.length) {
      await supabase.from('campaign_addons').insert(
        srcAddons.map((a: any) => ({ ...a, campaign_id: targetId }))
      );
    }
    const { data: src } = await supabase
      .from('campaigns')
      .select('strategy')
      .eq('id', sourceId)
      .maybeSingle();
    if (src?.strategy) {
      await supabase.from('campaigns').update({ strategy: src.strategy }).eq('id', targetId);
    }
  };

  const handleCreateCampaign = async (data: {
    name: string;
    focus: string;
    mode: 'agent' | 'self' | 'reuse';
    reuseFromCampaignId?: string;
  }) => {
    const insertPayload: any = {
      name: data.name,
      focus: data.focus || null,
      status: 'developing',
      strategy: null,
    };

    let createdId: string | undefined;

    if (isViewingClient && clientId) {
      const { data: result, error } = await supabase
        .from('campaigns')
        .insert({ ...insertPayload, user_id: clientId })
        .select()
        .single();
      if (error) {
        setShowCreateDialog(false);
        return;
      }
      createdId = result?.id;
    } else {
      const result = await createCampaign.mutateAsync(insertPayload);
      createdId = result?.id;
    }

    setShowCreateDialog(false);
    if (!createdId) return;

    if (data.mode === 'reuse' && data.reuseFromCampaignId) {
      await cloneCampaignAssets(data.reuseFromCampaignId, createdId);
    }

    const params = new URLSearchParams();
    if (data.mode === 'agent') params.set('agent', '1');
    if (isViewingClient && clientId) params.set('clientId', clientId);
    const qs = params.toString();
    navigate(`/campaign/${createdId}${qs ? `?${qs}` : ''}`);
  };

  if (authLoading) {
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
          <div className="flex items-center gap-4">
            {!isViewingClient && <WorkspaceSwitcher />}
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{user?.email}</span>
              {isAdmin && (
                <Badge className="bg-primary text-primary-foreground gap-1">
                  <Shield className="w-3 h-3" />
                  Admin
                </Badge>
              )}
              {isManager && !isAdmin && (
                <Badge variant="outline" className="border-primary text-primary gap-1">
                  <Shield className="w-3 h-3" />
                  Manager
                </Badge>
              )}
            </div>
            <ThemeToggle />
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
            {isManager && !isAdmin && !isViewingClient && managedClientIds.length > 0 && (
              <Button variant="outline" onClick={() => navigate('/admin')}>
                <Shield className="w-4 h-4 mr-2" />
                Manager Dashboard
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowReportDialog(true)}>
              <FileSearch className="w-4 h-4 mr-2" />
              Practice Report
            </Button>
            <Button variant="outline" onClick={() => navigate(isViewingClient && clientId ? `/knowledge-base?clientId=${clientId}` : '/knowledge-base')}>
              <BookOpen className="w-4 h-4 mr-2" />
              Knowledge Base
            </Button>
            <Button variant="outline" onClick={() => navigate('/schedule')}>
              <CalendarDays className="w-4 h-4 mr-2" />
              Posting Calendar
            </Button>
            <Button variant="outline" onClick={() => navigate('/settings/workspace')}>
              <Users className="w-4 h-4 mr-2" />
              Team
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
        targetUserId={isViewingClient && clientId ? clientId : undefined}
      />

      <GeneratePracticeReportDialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        defaultPracticeName={profile?.practice_name || ''}
        defaultWebsiteUrl={profile?.website_url || ''}
      />

      {isViewingClient && clientId && (
        <EditClientDialog
          open={showEditClient}
          onClose={() => setShowEditClient(false)}
          clientId={clientId}
          onDeleted={() => navigate('/admin')}
        />
      )}
    </div>
  );
};

export default Dashboard;
