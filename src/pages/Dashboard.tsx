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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Plus, Shield, User, ArrowLeft } from 'lucide-react';
import GeneratePracticeReportDialog from '@/components/dashboard/GeneratePracticeReportDialog';
import EditClientDialog from '@/components/admin/EditClientDialog';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import ConnectedPlatformsDialog from '@/components/dashboard/ConnectedPlatformsDialog';
import ResearchReportsBanner from '@/components/dashboard/ResearchReportsBanner';
import { SetupChecklist, type SetupStep } from '@/components/dashboard/SetupChecklist';
import CampaignKPIGrid from '@/components/dashboard/CampaignKPIGrid';
import CampaignActivityChart from '@/components/dashboard/CampaignActivityChart';
import AnnualROIChart from '@/components/dashboard/AnnualROIChart';
import { toast } from 'sonner';

const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok'];

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const legacyClientId = searchParams.get('clientId');
  const { user, isAdmin, isManager, managedClientIds, signOut, isLoading: authLoading, isRoleLoading } = useAuth();
  const { startImpersonation, impersonatedUserId } = useImpersonation();
  const { activeLocationId, isLoading: workspaceLoading } = useWorkspace();

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
  const { profile, isLoading: profileLoading } = useProfile();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [showPlatformsDialog, setShowPlatformsDialog] = useState(false);

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
    enabled: isViewingClient && !isRoleLoading,
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
    enabled: isViewingClient && !isRoleLoading,
  });

  // Practice that the onboarding research belongs to (self, or the viewed client).
  const reportUserId = isViewingClient ? clientId : user?.id;
  const reportWebsite = isViewingClient ? (clientProfile as any)?.website_url : profile?.website_url;
  const reportBundleTeam = isViewingClient
    ? (clientProfile as any)?.bundle_social_team_id
    : profile?.bundle_social_team_id;

  const { data: hasConnectedSocial = false } = useQuery({
    queryKey: ['has-connected-social', reportUserId],
    enabled: !!reportUserId && !isRoleLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_credentials')
        .select('platform_name')
        .eq('user_id', reportUserId!);
      if (error) return false;
      return (data || []).some((c: any) =>
        SOCIAL_PLATFORMS.includes((c.platform_name || '').toLowerCase()),
      );
    },
  });

  // Analysis must exist before a practice owner can create campaigns.
  const { data: analysisDocCount = 0 } = useQuery({
    queryKey: ['analysis-doc-count', reportUserId],
    enabled: !!reportUserId && !isRoleLoading,
    queryFn: async () => {
      const { count } = await supabase
        .from('knowledge_base')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', reportUserId!);
      return count ?? 0;
    },
  });
  const hasAnalysis = (analysisDocCount ?? 0) > 0 || (profile as any)?.onboarding_reports_status === 'complete';

  const displayCampaigns = isViewingClient ? clientCampaigns : campaigns;
  const displayLoading = isViewingClient ? clientCampaignsLoading : campaignsLoading;
  const displayName = isViewingClient
    ? clientProfile?.practice_name || clientProfile?.email || 'Client'
    : profile?.practice_name;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Open dashboard action dialogs triggered from the sidebar.
  useEffect(() => {
    const dialog = searchParams.get('dialog');
    if (!dialog) return;
    if (dialog === 'practice-report') setShowReportDialog(true);
    if (dialog === 'connected-platforms') setShowPlatformsDialog(true);
    if (dialog === 'edit-client') setShowEditClient(true);
  }, [searchParams]);

  const clearDialogParam = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('dialog');
    setSearchParams(next, { replace: true });
  };

  // First-run gate: send brand-new practice owners into the onboarding wizard
  // until they've told us who they are. Staff and impersonated views skip it,
  // and "Skip for now" sets a flag so we don't loop.
  const isPracticeOwner = !isViewingClient && !isAdmin && !isManager;
  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !isPracticeOwner) return;
    if (typeof window !== 'undefined' && localStorage.getItem('archer_skip_onboarding') === '1') return;
    const needsOnboarding = !profile || !profile.practice_name || !profile.website_url;
    if (needsOnboarding) navigate('/onboarding', { replace: true });
  }, [authLoading, profileLoading, user, isPracticeOwner, profile, navigate]);

  const handleNewCampaign = () => {
    if (isPracticeOwner && !hasAnalysis) {
      toast.info('Finishing your practice analysis first', {
        description: 'We complete your analysis before building campaigns so everything is on-brand.',
      });
      navigate('/onboarding');
      return;
    }
    setShowCreateDialog(true);
  };

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
    targetAudience: string;
    mode: 'agent' | 'self' | 'reuse';
    reuseFromCampaignId?: string;
    budgetAmount: number;
    durationValue: number;
    durationUnit: 'days' | 'weeks' | 'months';
  }) => {
    const today = new Date().toISOString().slice(0, 10);
    const insertPayload: any = {
      name: data.name,
      focus: data.focus || null,
      target_audience: data.targetAudience || null,
      status: 'developing',
      strategy: null,
      duration_value: data.durationValue,
      duration_unit: data.durationUnit,
      start_date: today,
    };

    let createdId: string | undefined;

    if (isViewingClient && clientId) {
      if (!activeLocationId) {
        toast.error('Could not create campaign', { description: 'No client location is available yet. Please try again.' });
        return;
      }
      const { data: result, error } = await supabase
        .from('campaigns')
        .insert({ ...insertPayload, user_id: clientId, location_id: activeLocationId })
        .select()
        .single();
      if (error) {
        toast.error('Failed to create campaign', { description: error.message });
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

    // Seed campaign budget (non-blocking on failure)
    const { error: budgetError } = await supabase
      .from('campaign_budgets')
      .insert({
        campaign_id: createdId,
        total_amount: data.budgetAmount,
        allocations: {},
        accepted: false,
      });
    if (budgetError) {
      toast.warning('Campaign created, but budget could not be saved', { description: budgetError.message });
    }

    toast.success('Campaign created successfully!');
    if (isViewingClient && clientId) {
      await queryClient.invalidateQueries({ queryKey: ['client-campaigns', clientId] });
    }

    if (data.mode === 'reuse' && data.reuseFromCampaignId) {
      await cloneCampaignAssets(data.reuseFromCampaignId, createdId);
    }

    // Kick off the Campaign Agent pipeline in the background for AI-designed campaigns.
    if (data.mode === 'agent') {
      supabase.functions
        .invoke('run-campaign-agent', {
          body: { campaignId: createdId, topic: data.focus || undefined },
        })
        .catch((e) => console.error('run-campaign-agent invocation failed', e));
    }

    const params = new URLSearchParams();
    if (data.mode === 'agent') params.set('generating', '1');
    if (isViewingClient && clientId) params.set('clientId', clientId);
    const qs = params.toString();
    navigate(`/campaign/${createdId}${qs ? `?${qs}` : ''}`);
  };

  if (authLoading || (impersonatedUserId && isRoleLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary-foreground">Loading...</div>
      </div>
    );
  }

  const latestCampaignId = displayCampaigns && displayCampaigns.length ? displayCampaigns[0].id : null;
  const setupSteps: SetupStep[] = [
    {
      key: 'scan',
      title: 'Scan your practice',
      desc: 'Let Archer learn your brand from your website.',
      done: !!profile?.website_url,
      actionLabel: 'Scan',
      onAction: () => navigate('/onboarding'),
    },
    {
      key: 'campaign',
      title: 'Create your first campaign',
      desc: "Archer's AI strategist drafts a full plan for you.",
      done: (campaigns?.length ?? 0) > 0,
      actionLabel: 'Create',
      onAction: handleNewCampaign,
    },
    {
      key: 'content',
      title: 'Generate content',
      desc: 'Turn your plan into posts and images for every channel.',
      done: (campaigns ?? []).some((c: any) =>
        ['content_ready', 'completed'].includes(c.generation_status) ||
        ['scheduled', 'active', 'ended'].includes(c.status),
      ),
      actionLabel: 'Generate',
      onAction: () => (latestCampaignId ? navigate(`/campaign/${latestCampaignId}`) : handleNewCampaign()),
    },
    {
      key: 'connect',
      title: 'Connect a social account',
      desc: 'Link a platform so Archer can publish for you.',
      done: hasConnectedSocial || !!profile?.bundle_social_team_id,
      actionLabel: 'Connect',
      onAction: () => setShowPlatformsDialog(true),
    },
    {
      key: 'publish',
      title: 'Schedule and publish',
      desc: 'Put your posts on the calendar and go live.',
      done: (campaigns ?? []).some((c: any) => ['active', 'ended'].includes(c.status)),
      actionLabel: 'Schedule',
      onAction: () => navigate('/schedule'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-lg">
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
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {isViewingClient
                  ? `${displayName}'s Dashboard`
                  : `Welcome back${displayName ? `, ${displayName}` : ''}!`}
              </h1>
              <p className="text-muted-foreground">
                {isViewingClient ? 'Viewing as admin' : 'Manage your marketing campaigns'}
              </p>
            </div>
          </div>
        </div>

        {/* Guided setup / next-best-action */}
        {isPracticeOwner && (
          <div className="mb-8">
            <SetupChecklist steps={setupSteps} />
          </div>
        )}

        {/* Onboarding research suite */}
        {reportUserId && (
          <div className="mb-8">
            <ResearchReportsBanner
              targetUserId={reportUserId}
              hasWebsite={!!reportWebsite}
              hasConnectedSocial={hasConnectedSocial || !!reportBundleTeam}
            />
          </div>
        )}

        {/* Campaigns Table */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">
              All Campaigns
            </h2>
            <Button onClick={handleNewCampaign}>
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>
          <CampaignsTable
            campaigns={displayCampaigns}
            isLoading={displayLoading}
            onCreateCampaign={handleNewCampaign}
          />
        </div>
      </main>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateCampaign}
        isLoading={createCampaign.isPending || workspaceLoading}
        targetUserId={isViewingClient && clientId ? clientId : undefined}
      />

      <GeneratePracticeReportDialog
        open={showReportDialog}
        onClose={() => { setShowReportDialog(false); clearDialogParam(); }}
        defaultPracticeName={profile?.practice_name || ''}
        defaultWebsiteUrl={profile?.website_url || ''}
      />

      {isViewingClient && clientId && (
        <EditClientDialog
          open={showEditClient}
          onClose={() => { setShowEditClient(false); clearDialogParam(); }}
          clientId={clientId}
          onDeleted={() => navigate('/admin')}
        />
      )}

      <ConnectedPlatformsDialog
        open={showPlatformsDialog}
        onOpenChange={(open) => {
          setShowPlatformsDialog(open);
          if (!open) clearDialogParam();
        }}
      />
    </div>
  );
};

export default Dashboard;
