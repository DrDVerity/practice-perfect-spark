import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Copy, Loader2, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface MemberRow {
  user_id: string;
  role: 'owner' | 'member';
  email?: string;
  full_name?: string;
  location_ids: string[];
}

interface InviteRow {
  id: string;
  email: string;
  token: string;
  invited_locations: string[];
  expires_at: string;
  accepted_at: string | null;
}

const WorkspaceSettings = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { account, accountId, locations, isOwner, refresh, isLoading } = useWorkspace();

  const [newLocName, setNewLocName] = useState('');
  const [creatingLoc, setCreatingLoc] = useState(false);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLocations, setInviteLocations] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user, navigate]);

  const loadMembersAndInvites = async () => {
    if (!accountId) return;
    setLoadingMembers(true);
    try {
      const { data: amData } = await supabase
        .from('account_members')
        .select('user_id, role')
        .eq('account_id', accountId);

      const userIds = (amData || []).map((m: any) => m.user_id);
      const { data: profs } = userIds.length
        ? await supabase
            .from('profiles')
            .select('user_id, email, full_name')
            .in('user_id', userIds)
        : { data: [] as any[] };

      const { data: lm } = userIds.length
        ? await supabase
            .from('location_members')
            .select('user_id, location_id')
            .in('user_id', userIds)
        : { data: [] as any[] };

      const profileMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      const locByUser = new Map<string, string[]>();
      (lm || []).forEach((row: any) => {
        const arr = locByUser.get(row.user_id) || [];
        arr.push(row.location_id);
        locByUser.set(row.user_id, arr);
      });

      const merged: MemberRow[] = (amData || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        email: profileMap.get(m.user_id)?.email,
        full_name: profileMap.get(m.user_id)?.full_name,
        location_ids: locByUser.get(m.user_id) || [],
      }));
      setMembers(merged);

      const { data: invData } = await supabase
        .from('account_invites')
        .select('*')
        .eq('account_id', accountId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });
      setInvites((invData || []) as any);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => { loadMembersAndInvites(); }, [accountId]);

  const createLocation = async () => {
    const name = newLocName.trim();
    if (!name || !accountId) return;
    setCreatingLoc(true);
    try {
      const { data, error } = await supabase
        .from('locations')
        .insert({ account_id: accountId, name })
        .select()
        .single();
      if (error) throw error;
      // auto-add current user as member
      if (user) {
        await supabase.from('location_members').insert({ location_id: data.id, user_id: user.id });
      }
      setNewLocName('');
      await refresh();
      toast.success('Location created');
    } catch (e: any) {
      toast.error('Could not create location', { description: e.message });
    } finally {
      setCreatingLoc(false);
    }
  };

  const deleteLocation = async (locId: string) => {
    if (!confirm('Delete this location and all its data? This cannot be undone.')) return;
    const { error } = await supabase.from('locations').delete().eq('id', locId);
    if (error) { toast.error(error.message); return; }
    toast.success('Location deleted');
    await refresh();
  };

  const toggleMemberLocation = async (userId: string, locId: string, currentlyMember: boolean) => {
    if (currentlyMember) {
      await supabase.from('location_members').delete().eq('user_id', userId).eq('location_id', locId);
    } else {
      await supabase.from('location_members').insert({ user_id: userId, location_id: locId });
    }
    await loadMembersAndInvites();
  };

  const removeMember = async (userId: string) => {
    if (!accountId) return;
    if (userId === account?.owner_user_id) {
      toast.error("Can't remove the account owner");
      return;
    }
    if (!confirm('Remove this member from the entire account?')) return;
    // delete all their location memberships in this account
    const locIds = locations.map((l) => l.id);
    await supabase.from('location_members').delete().eq('user_id', userId).in('location_id', locIds);
    await supabase.from('account_members').delete().eq('account_id', accountId).eq('user_id', userId);
    toast.success('Member removed');
    await loadMembersAndInvites();
  };

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !accountId || !user) return;
    if (inviteLocations.length === 0) {
      toast.error('Pick at least one location');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase
        .from('account_invites')
        .insert({
          account_id: accountId,
          email,
          invited_locations: inviteLocations,
          invited_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      const link = `${window.location.origin}/invite/${(data as any).token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success('Invite link copied to clipboard', { description: link });
      setInviteEmail('');
      setInviteLocations([]);
      setInviteOpen(false);
      await loadMembersAndInvites();
    } catch (e: any) {
      toast.error('Could not create invite', { description: e.message });
    } finally {
      setSending(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied');
  };

  const revokeInvite = async (id: string) => {
    await supabase.from('account_invites').delete().eq('id', id);
    await loadMembersAndInvites();
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (!isOwner) {
    return (
      <div className="container py-16 max-w-2xl">
        <p className="text-muted-foreground">Only the account owner can manage workspace settings.</p>
        <Button onClick={() => navigate(-1)} variant="outline" className="mt-4">Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Workspace Settings</h1>
          <p className="text-muted-foreground mt-1">
            {account?.name} — manage locations and team members.
          </p>
        </div>

        <Tabs defaultValue="locations">
          <TabsList>
            <TabsTrigger value="locations"><Building2 className="w-4 h-4 mr-2" />Locations</TabsTrigger>
            <TabsTrigger value="members"><Users className="w-4 h-4 mr-2" />Members</TabsTrigger>
            <TabsTrigger value="invites"><UserPlus className="w-4 h-4 mr-2" />Invites</TabsTrigger>
          </TabsList>

          {/* LOCATIONS */}
          <TabsContent value="locations" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Add a location</CardTitle>
                <CardDescription>Each location has its own campaigns, channels, and KB.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Downtown Office"
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                  />
                  <Button onClick={createLocation} disabled={creatingLoc || !newLocName.trim()}>
                    <Plus className="w-4 h-4 mr-2" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {locations.map((loc) => (
                <Card key={loc.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-primary" />
                      <div>
                        <div className="font-medium">{loc.name}</div>
                        {loc.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                      </div>
                    </div>
                    {!loc.is_default && (
                      <Button variant="ghost" size="sm" onClick={() => deleteLocation(loc.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* MEMBERS */}
          <TabsContent value="members" className="space-y-4 mt-4">
            {loadingMembers ? (
              <Loader2 className="animate-spin" />
            ) : members.length === 0 ? (
              <p className="text-muted-foreground">No members yet.</p>
            ) : (
              members.map((m) => (
                <Card key={m.user_id}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{m.full_name || m.email}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={m.role === 'owner' ? 'default' : 'outline'}>{m.role}</Badge>
                        {m.role !== 'owner' && (
                          <Button variant="ghost" size="sm" onClick={() => removeMember(m.user_id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t">
                      <div className="text-xs uppercase text-muted-foreground col-span-full">Location access</div>
                      {locations.map((loc) => {
                        const has = m.location_ids.includes(loc.id) || m.role === 'owner';
                        return (
                          <label key={loc.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={has}
                              disabled={m.role === 'owner'}
                              onCheckedChange={() => toggleMemberLocation(m.user_id, loc.id, has)}
                            />
                            {loc.name}
                          </label>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* INVITES */}
          <TabsContent value="invites" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Teammates you invite will publish through <strong>your connected Bundle.social channels</strong>.
              They share the same social account connections — no separate setup needed.
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="w-4 h-4 mr-2" />Invite a teammate</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite by email</DialogTitle>
                  <DialogDescription>They'll get a shareable link to join. No email is sent automatically.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>Give access to which locations?</Label>
                    <div className="mt-2 space-y-2">
                      {locations.map((loc) => (
                        <label key={loc.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={inviteLocations.includes(loc.id)}
                            onCheckedChange={(c) => {
                              setInviteLocations((prev) =>
                                c ? [...prev, loc.id] : prev.filter((id) => id !== loc.id)
                              );
                            }}
                          />
                          {loc.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
                  <Button onClick={sendInvite} disabled={sending || !inviteEmail.trim()}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create invite link'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {invites.length === 0 ? (
              <p className="text-muted-foreground text-sm">No pending invites.</p>
            ) : (
              invites.map((inv) => (
                <Card key={inv.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="font-medium">{inv.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Expires {new Date(inv.expires_at).toLocaleDateString()} ·{' '}
                        {inv.invited_locations.length} location(s)
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyInviteLink(inv.token)}>
                        <Copy className="w-4 h-4 mr-2" /> Copy link
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => revokeInvite(inv.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WorkspaceSettings;
