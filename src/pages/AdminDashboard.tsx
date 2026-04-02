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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Users, Megaphone, ChevronDown, ChevronRight, CalendarDays, Plus, Pencil, Trash2, BookOpen, FileText, Search, Sparkles, Loader2, Shield, UserCheck, UserX } from 'lucide-react';
import { usePlatformRules } from '@/hooks/usePlatformRules';
import EditClientDialog from '@/components/admin/EditClientDialog';
import CreateClientDialog from '@/components/admin/CreateClientDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDocTypeLabel, KBDocumentType } from '@/hooks/useKnowledgeBase';
import { format } from 'date-fns';

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

interface KBDoc {
  id: string;
  user_id: string;
  title: string;
  doc_type: KBDocumentType;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const docTypeColors: Record<string, string> = {
  platform_rules: 'bg-blue-500/20 text-blue-700',
  audience_analysis: 'bg-purple-500/20 text-purple-700',
  market_analysis: 'bg-green-500/20 text-green-700',
  competitive_landscape: 'bg-orange-500/20 text-orange-700',
  demographics: 'bg-pink-500/20 text-pink-700',
  brand_guidelines: 'bg-amber-500/20 text-amber-700',
  custom: 'bg-muted text-muted-foreground',
};

const allDocTypes: KBDocumentType[] = [
  'platform_rules', 'audience_analysis', 'market_analysis',
  'competitive_landscape', 'demographics', 'brand_guidelines', 'custom',
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, isManager, managedClientIds, user, isLoading: authLoading } = useAuth();
  const [activeView, setActiveView] = useState<'overview' | 'accounts' | 'campaigns' | 'knowledge_base'>('overview');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [kbSearch, setKbSearch] = useState('');
  const [kbFilterClient, setKbFilterClient] = useState<string>('all');
  const [editingKBDoc, setEditingKBDoc] = useState<KBDoc | null>(null);
  const [kbFormTitle, setKbFormTitle] = useState('');
  const [kbFormType, setKbFormType] = useState<KBDocumentType>('custom');
  const [kbFormContent, setKbFormContent] = useState('');
  const [assigningManagerId, setAssigningManagerId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { generateAllPlatformRules, isGenerating: isGeneratingRules } = usePlatformRules();

  // Fetch all profiles (admin only)
  const { data: profiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, practice_name, email')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProfileWithCampaigns[];
    },
    enabled: isAdmin || isManager,
  });
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

  // Fetch all KB docs (admin only)
  const { data: allKBDocs = [], refetch: refetchKBDocs } = useQuery({
    queryKey: ['admin-kb-docs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('knowledge_base')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as KBDoc[];
    },
    enabled: isAdmin,
  });

  // Fetch all user roles
  const { data: allRoles = [], refetch: refetchRoles } = useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch all manager assignments
  const { data: allAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['admin-manager-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manager_assignments')
        .select('*');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const getUserRoles = (userId: string) => allRoles.filter(r => r.user_id === userId).map(r => r.role);
  const isUserManager = (userId: string) => getUserRoles(userId).includes('manager');
  const isUserAdmin = (userId: string) => getUserRoles(userId).includes('admin');
  const getManagerAssignments = (managerId: string) => allAssignments.filter(a => a.manager_user_id === managerId);
  const getClientManagers = (clientId: string) => allAssignments.filter(a => a.client_user_id === clientId);

  const handlePromoteToManager = async (userId: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'manager' as any });
    if (error) { toast.error('Failed to promote user'); return; }
    toast.success('User promoted to Manager');
    refetchRoles();
  };

  const handleDemoteManager = async (userId: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'manager' as any);
    if (error) { toast.error('Failed to demote user'); return; }
    // Also remove their assignments
    await supabase.from('manager_assignments').delete().eq('manager_user_id', userId);
    toast.success('User demoted from Manager');
    refetchRoles();
    refetchAssignments();
  };

  const handleAssignClient = async (managerId: string, clientId: string) => {
    if (!user) return;
    const { error } = await supabase.from('manager_assignments').insert({
      manager_user_id: managerId,
      client_user_id: clientId,
      assigned_by: user.id,
    });
    if (error) { toast.error('Failed to assign client'); return; }
    toast.success('Client assigned to manager');
    refetchAssignments();
  };

  const handleUnassignClient = async (managerId: string, clientId: string) => {
    const { error } = await supabase.from('manager_assignments')
      .delete()
      .eq('manager_user_id', managerId)
      .eq('client_user_id', clientId);
    if (error) { toast.error('Failed to unassign client'); return; }
    toast.success('Client unassigned');
    refetchAssignments();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-primary/50 flex items-center justify-center">
        <div className="animate-pulse text-primary-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin && !isManager) {
    navigate('/dashboard');
    return null;
  }

  // For managers, filter data to only their assigned clients
  const visibleProfiles = isAdmin ? profiles : profiles.filter(p => managedClientIds.includes(p.user_id));
  const visibleCampaigns = isAdmin ? allCampaigns : allCampaigns.filter(c => managedClientIds.includes(c.user_id));
  const visibleKBDocs = isAdmin ? allKBDocs : allKBDocs.filter(d => managedClientIds.includes(d.user_id));

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

  // KB helpers
  const filteredKBDocs = allKBDocs.filter(doc => {
    const matchesSearch = !kbSearch ||
      doc.title.toLowerCase().includes(kbSearch.toLowerCase()) ||
      doc.content.toLowerCase().includes(kbSearch.toLowerCase());
    const matchesClient = kbFilterClient === 'all' || doc.user_id === kbFilterClient;
    return matchesSearch && matchesClient;
  });

  const kbDocsByClient = filteredKBDocs.reduce((acc, doc) => {
    if (!acc[doc.user_id]) acc[doc.user_id] = [];
    acc[doc.user_id].push(doc);
    return acc;
  }, {} as Record<string, KBDoc[]>);

  const openEditKBDoc = (doc: KBDoc) => {
    setEditingKBDoc(doc);
    setKbFormTitle(doc.title);
    setKbFormType(doc.doc_type);
    setKbFormContent(doc.content);
  };

  const handleSaveKBDoc = async () => {
    if (!editingKBDoc) return;
    const { error } = await (supabase as any)
      .from('knowledge_base')
      .update({ title: kbFormTitle, doc_type: kbFormType, content: kbFormContent })
      .eq('id', editingKBDoc.id);
    if (error) { toast.error('Failed to update document'); return; }
    toast.success('Document updated');
    setEditingKBDoc(null);
    refetchKBDocs();
  };

  const handleDeleteKBDoc = async (id: string) => {
    const { error } = await (supabase as any)
      .from('knowledge_base')
      .delete()
      .eq('id', id);
    if (error) { toast.error('Failed to delete document'); return; }
    toast.success('Document deleted');
    refetchKBDocs();
  };

  const handleDeleteClient = async (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const { error: campError } = await supabase.from('campaigns').delete().eq('user_id', userId);
    if (campError) { toast.error('Failed to delete campaigns'); return; }
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
    if (error) { toast.error('Failed to delete account'); return; }
    toast.success('Account deleted');
    queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
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

            {/* Tile 3: Knowledge Base */}
            <Card
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
              onClick={() => setActiveView('knowledge_base')}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Knowledge Base Docs</p>
                  <p className="text-3xl font-bold text-foreground">{allKBDocs.length}</p>
                  <p className="text-xs text-primary mt-1">Click to manage</p>
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
              <div className="ml-auto">
                <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Account
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Campaigns</TableHead>
                    <TableHead className="w-36">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => {
                    const userCampaigns = campaignsByUser[profile.user_id] || [];
                    const roles = getUserRoles(profile.user_id);
                    const hasManager = isUserManager(profile.user_id);
                    const hasAdmin = isUserAdmin(profile.user_id);
                    const assignments = getManagerAssignments(profile.user_id);
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
                             <div className="flex gap-1 flex-wrap">
                               {hasAdmin && <Badge className="bg-primary text-primary-foreground"><Shield className="w-3 h-3 mr-1" />Admin</Badge>}
                               {hasManager && <Badge variant="outline" className="border-primary text-primary"><UserCheck className="w-3 h-3 mr-1" />Manager</Badge>}
                               {!hasAdmin && !hasManager && <Badge variant="secondary">User</Badge>}
                               {hasManager && assignments.length > 0 && (
                                 <Badge variant="secondary" className="text-xs">{assignments.length} assigned</Badge>
                               )}
                             </div>
                           </TableCell>
                           <TableCell>
                              <Badge variant="secondary">{userCampaigns.length}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {!hasAdmin && !hasManager && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Promote to Manager"
                                    onClick={(e) => { e.stopPropagation(); handlePromoteToManager(profile.user_id); }}
                                  >
                                    <UserCheck className="w-4 h-4 text-primary" />
                                  </Button>
                                )}
                                {hasManager && !hasAdmin && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="Manage Assignments"
                                      onClick={(e) => { e.stopPropagation(); setAssigningManagerId(profile.user_id); }}
                                    >
                                      <Users className="w-4 h-4 text-primary" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="Demote from Manager"
                                      onClick={(e) => { e.stopPropagation(); handleDemoteManager(profile.user_id); }}
                                    >
                                      <UserX className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); setEditClientId(profile.user_id); }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete {profile.practice_name || 'this client'}'s profile and campaigns.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={(e) => handleDeleteClient(profile.user_id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
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
        {activeView === 'knowledge_base' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setActiveView('overview')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <h2 className="text-xl font-semibold text-foreground">Knowledge Base — All Clients</h2>
              <Badge variant="secondary">{allKBDocs.length} docs</Badge>
              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    // Find admin user_id
                    const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1);
                    const adminUserId = adminRoles?.[0]?.user_id;
                    if (adminUserId) {
                      await generateAllPlatformRules(adminUserId);
                      refetchKBDocs();
                    } else {
                      toast.error('Admin user not found');
                    }
                  }}
                  disabled={isGeneratingRules}
                  className="gap-2"
                >
                  {isGeneratingRules ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isGeneratingRules ? 'Generating...' : 'Generate All Platform Rules'}
                </Button>
              </div>
            </div>

            {/* Search & filter */}
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={kbSearch}
                  onChange={(e) => setKbSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={kbFilterClient} onValueChange={setKbFilterClient}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.practice_name || p.email || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Docs grouped by client */}
            {Object.entries(kbDocsByClient).length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No documents found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(kbDocsByClient).map(([userId, docs]) => (
                  <Collapsible
                    key={userId}
                    open={expandedAccounts.has(userId)}
                    onOpenChange={() => toggleAccount(userId)}
                    defaultOpen
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
                          <Badge variant="secondary">{docs.length} docs</Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-8 mt-1 rounded-xl border border-border bg-card overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Title</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Updated</TableHead>
                              <TableHead className="w-24">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {docs.map(doc => (
                              <TableRow
                                key={doc.id}
                                className="cursor-pointer hover:bg-accent/50"
                                onClick={() => openEditKBDoc(doc)}
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary shrink-0" />
                                    {doc.title}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={docTypeColors[doc.doc_type] || ''}>
                                    {getDocTypeLabel(doc.doc_type)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {format(new Date(doc.updated_at), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEditKBDoc(doc); }}>
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                                          <AlertDialogDescription>This will permanently delete "{doc.title}".</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteKBDoc(doc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
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
            )}
          </div>
        )}
      </main>

      {/* KB Edit Dialog */}
      <Dialog open={!!editingKBDoc} onOpenChange={(open) => { if (!open) setEditingKBDoc(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Edit Document — {editingKBDoc ? getProfileName(editingKBDoc.user_id) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={kbFormTitle} onChange={(e) => setKbFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={kbFormType} onValueChange={(v) => setKbFormType(v as KBDocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allDocTypes.map(type => (
                    <SelectItem key={type} value={type}>{getDocTypeLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={kbFormContent} onChange={(e) => setKbFormContent(e.target.value)} className="min-h-[250px]" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditingKBDoc(null)}>Cancel</Button>
              <Button onClick={handleSaveKBDoc}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditClientDialog
        open={!!editClientId}
        onClose={() => setEditClientId(null)}
        clientId={editClientId || ''}
        onDeleted={() => setEditClientId(null)}
      />

      <CreateClientDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {/* Manager Assignment Dialog */}
      <Dialog open={!!assigningManagerId} onOpenChange={(open) => { if (!open) setAssigningManagerId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Manage Client Assignments
            </DialogTitle>
          </DialogHeader>
          {assigningManagerId && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Assign or unassign client accounts for <strong>{getProfileName(assigningManagerId)}</strong>.
              </p>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {profiles
                  .filter(p => p.user_id !== assigningManagerId && !isUserAdmin(p.user_id))
                  .map(client => {
                    const isAssigned = allAssignments.some(
                      a => a.manager_user_id === assigningManagerId && a.client_user_id === client.user_id
                    );
                    return (
                      <div key={client.user_id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div>
                          <p className="font-medium text-sm">{client.practice_name || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground">{client.email || '—'}</p>
                        </div>
                        {isAssigned ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleUnassignClient(assigningManagerId!, client.user_id)}
                          >
                            <UserX className="w-3 h-3 mr-1" /> Unassign
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignClient(assigningManagerId!, client.user_id)}
                          >
                            <UserCheck className="w-3 h-3 mr-1" /> Assign
                          </Button>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setAssigningManagerId(null)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
