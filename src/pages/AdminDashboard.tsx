import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Users, Megaphone, ChevronDown, ChevronRight, CalendarDays } from 'lucide-react';

interface ProfileWithCampaigns {
  user_id: string;
  practice_name: string | null;
  email: string | null;
}

interface CampaignWithProfile {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  user_id: string;
  practice_name?: string | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [activeView, setActiveView] = useState<'overview' | 'accounts' | 'campaigns'>('overview');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // Fetch all profiles (admin only)
  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, practice_name, email')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProfileWithCampaigns[];
    },
    enabled: isAdmin,
  });

  // Fetch all campaigns (admin only)
  const { data: allCampaigns = [] } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name, status, start_date, end_date, user_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CampaignWithProfile[];
    },
    enabled: isAdmin,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-primary/50 flex items-center justify-center">
        <div className="animate-pulse text-primary-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/dashboard');
    return null;
  }

  const activeCampaigns = allCampaigns.filter(c => c.status === 'active');

  // Group campaigns by user_id
  const campaignsByUser = allCampaigns.reduce((acc, campaign) => {
    if (!acc[campaign.user_id]) acc[campaign.user_id] = [];
    acc[campaign.user_id].push(campaign);
    return acc;
  }, {} as Record<string, CampaignWithProfile[]>);

  const toggleAccount = (userId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const getProfileName = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.practice_name || p?.email || 'Unknown Account';
  };

  return (
    <div className="min-h-screen bg-primary/50">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo />
            <Badge className="bg-primary text-primary-foreground">Admin</Badge>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8 md:py-12">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

        {activeView === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            {/* Tile 1: All Practices */}
            <Card
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
              onClick={() => setActiveView('accounts')}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">All Practices/Accounts</p>
                  <p className="text-3xl font-bold text-foreground">{profiles.length}</p>
                  <p className="text-xs text-primary mt-1">Click to view</p>
                </div>
              </CardContent>
            </Card>

            {/* Tile 2: Campaigns Running */}
            <Card
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
              onClick={() => setActiveView('campaigns')}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Megaphone className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Campaigns Running</p>
                  <p className="text-3xl font-bold text-foreground">{activeCampaigns.length}</p>
                  <p className="text-xs text-primary mt-1">Click to view</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeView === 'accounts' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setActiveView('overview')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <h2 className="text-xl font-semibold text-foreground">All Practices/Accounts</h2>
              <Badge variant="secondary">{profiles.length}</Badge>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Campaigns</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => {
                    const userCampaigns = campaignsByUser[profile.user_id] || [];
                    const isExpanded = expandedAccounts.has(profile.user_id);
                    return (
                      <React.Fragment key={profile.user_id}>
                         <TableRow
                           className="cursor-pointer hover:bg-accent/50"
                           onClick={() => navigate(`/dashboard?clientId=${profile.user_id}`)}
                         >
                           <TableCell className="font-medium">
                             {profile.practice_name || 'Unnamed'}
                           </TableCell>
                           <TableCell className="text-muted-foreground">
                             {profile.email || '—'}
                           </TableCell>
                           <TableCell>
                             <Badge variant="secondary">
                               {userCampaigns.length}
                             </Badge>
                           </TableCell>
                       </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {activeView === 'campaigns' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setActiveView('overview')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <h2 className="text-xl font-semibold text-foreground">All Campaigns</h2>
              <Badge variant="secondary">{allCampaigns.length}</Badge>
            </div>
            <div className="space-y-2">
              {Object.entries(campaignsByUser).map(([userId, campaigns]) => (
                <Collapsible
                  key={userId}
                  open={expandedAccounts.has(userId)}
                  onOpenChange={() => toggleAccount(userId)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
                      <div className="flex items-center gap-3">
                        {expandedAccounts.has(userId) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-foreground">{getProfileName(userId)}</span>
                        <Badge variant="secondary">{campaigns.length} campaigns</Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mt-1 rounded-xl border border-border bg-card overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Schedule</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campaigns.map((campaign) => (
                            <TableRow
                              key={campaign.id}
                              className="cursor-pointer hover:bg-accent/50"
                              onClick={() => navigate(`/campaign/${campaign.id}`)}
                            >
                              <TableCell className="font-medium">{campaign.name}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={
                                    campaign.status === 'active'
                                      ? 'bg-green-500/20 text-green-600'
                                      : campaign.status === 'developing'
                                      ? 'bg-amber-500/20 text-amber-600'
                                      : ''
                                  }
                                >
                                  {campaign.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/schedule');
                                  }}
                                >
                                  <CalendarDays className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
