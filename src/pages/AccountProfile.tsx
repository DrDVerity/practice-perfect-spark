import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Save, Trash2, GitMerge, Pencil, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  user_id: string;
  practice_name: string | null;
  email: string | null;
  full_name: string | null;
  website_url: string | null;
  parent_account_id: string | null;
  deleted_at: string | null;
}

const AccountProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isManager, managedClientIds, isLoading: authLoading } = useAuth();

  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [subEditForm, setSubEditForm] = useState<{ full_name: string; email: string }>({ full_name: '', email: '' });
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [merging, setMerging] = useState(false);

  const canManage = isAdmin || (isManager && userId && managedClientIds.includes(userId));
  const canMerge = isAdmin; // merging is admin-only

  // Load this account
  const { data: account, refetch: refetchAccount, isLoading: loadingAccount } = useQuery({
    queryKey: ['account-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, practice_name, email, full_name, website_url, parent_account_id, deleted_at')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      if (data) setEditForm(data as Profile);
      return data as Profile | null;
    },
    enabled: !!userId && !!canManage,
  });

  // Load sub-accounts
  const { data: subs = [], refetch: refetchSubs } = useQuery({
    queryKey: ['account-subs', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, practice_name, email, full_name, website_url, parent_account_id, deleted_at')
        .eq('parent_account_id', userId!)
        .is('deleted_at', null);
      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: !!userId && !!canManage,
  });

  // Load campaigns
  const { data: campaigns = [], refetch: refetchCampaigns } = useQuery({
    queryKey: ['account-campaigns', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name, status, start_date, end_date, user_id')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!canManage,
  });

  // Load all other businesses for merge target
  const { data: otherBusinesses = [] } = useQuery({
    queryKey: ['merge-targets', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, practice_name, email')
        .is('deleted_at', null)
        .is('parent_account_id', null)
        .neq('user_id', userId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && canMerge,
  });

  const mergeTarget = useMemo(
    () => otherBusinesses.find((b) => b.user_id === mergeTargetId),
    [otherBusinesses, mergeTargetId]
  );

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        practice_name: editForm.practice_name ?? null,
        full_name: editForm.full_name ?? null,
        email: editForm.email ?? null,
        website_url: editForm.website_url ?? null,
      })
      .eq('user_id', userId);
    setSavingProfile(false);
    if (error) {
      toast.error('Failed to save', { description: error.message });
    } else {
      toast.success('Account saved');
      refetchAccount();
    }
  };

  const handleSaveSub = async (subId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: subEditForm.full_name, email: subEditForm.email })
      .eq('user_id', subId);
    if (error) {
      toast.error('Failed', { description: error.message });
    } else {
      toast.success('Sub-account updated');
      setEditingSubId(null);
      refetchSubs();
    }
  };

  const handleDeleteSubOrAccount = async (id: string) => {
    const { data, error } = await supabase.functions.invoke('admin-delete-account', {
      body: { user_id: id, mode: 'purge' },
    });
    if (error || (data as any)?.error) {
      toast.error('Delete failed', { description: error?.message || (data as any)?.error });
      return false;
    }
    toast.success('Account permanently removed');
    return true;
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    const { data: channels } = await supabase
      .from('campaign_channels')
      .select('id')
      .eq('campaign_id', campaignId);
    if (channels && channels.length > 0) {
      const ids = channels.map((c) => c.id);
      await supabase.from('channel_posts').delete().in('campaign_channel_id', ids);
      await supabase.from('campaign_channels').delete().eq('campaign_id', campaignId);
    }
    const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (error) {
      toast.error('Failed to delete campaign');
      return;
    }
    toast.success('Campaign deleted');
    setDeletingCampaignId(null);
    refetchCampaigns();
  };

  const handleMerge = async () => {
    if (!userId || !mergeTargetId) return;
    setMerging(true);
    try {
      // Reassign campaigns
      const { error: cErr } = await supabase
        .from('campaigns')
        .update({ user_id: mergeTargetId })
        .eq('user_id', userId);
      if (cErr) throw cErr;

      // Reassign knowledge base
      await supabase.from('knowledge_base').update({ user_id: mergeTargetId }).eq('user_id', userId);

      // Reassign channel credentials
      await supabase.from('channel_credentials').update({ user_id: mergeTargetId }).eq('user_id', userId);

      // Reassign campaign_vault
      await supabase.from('campaign_vault').update({ user_id: mergeTargetId }).eq('user_id', userId);

      // Re-parent sub-accounts to target
      await supabase.from('profiles').update({ parent_account_id: mergeTargetId }).eq('parent_account_id', userId);

      // Soft-delete source account
      const { data, error } = await supabase.functions.invoke('admin-delete-account', {
        body: { user_id: userId, mode: 'purge' },
      });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);

      toast.success('Accounts consolidated');
      navigate(`/admin/account/${mergeTargetId}`);
    } catch (e: any) {
      toast.error('Merge failed', { description: e.message });
    } finally {
      setMerging(false);
      setConfirmMerge(false);
    }
  };

  if (authLoading || loadingAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">You don't have permission to view this account.</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Account not found.</p>
          <Button onClick={() => navigate('/admin')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
          </Button>
          <h1 className="text-2xl font-semibold flex-1">{account.practice_name || 'Unnamed Business'}</h1>
          <Badge variant="secondary">{subs.length} sub-account{subs.length === 1 ? '' : 's'}</Badge>
          <Badge variant="outline">{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</Badge>
        </div>

        {/* Profile editor */}
        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Business name</Label>
                <Input
                  value={editForm.practice_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, practice_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Owner full name</Label>
                <Input
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Website</Label>
                <Input
                  value={editForm.website_url || ''}
                  onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sub-accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Sub-accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {subs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No sub-accounts attached.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => (
                    <TableRow key={s.user_id}>
                      <TableCell>
                        {editingSubId === s.user_id ? (
                          <Input
                            value={subEditForm.full_name}
                            onChange={(e) => setSubEditForm({ ...subEditForm, full_name: e.target.value })}
                          />
                        ) : (
                          s.full_name || '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {editingSubId === s.user_id ? (
                          <Input
                            value={subEditForm.email}
                            onChange={(e) => setSubEditForm({ ...subEditForm, email: e.target.value })}
                          />
                        ) : (
                          <span className="text-muted-foreground">{s.email || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {editingSubId === s.user_id ? (
                          <>
                            <Button size="sm" onClick={() => handleSaveSub(s.user_id)}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingSubId(null)}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingSubId(s.user_id);
                                setSubEditForm({ full_name: s.full_name || '', email: s.email || '' });
                              }}
                            >
                              <Pencil className="w-3 h-3 mr-1" /> Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDeletingSubId(s.user_id)}>
                              <Trash2 className="w-3 h-3 mr-1" /> Delete
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No campaigns yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.start_date ? new Date(c.start_date).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.end_date ? new Date(c.end_date).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/campaign/${c.id}?clientId=${userId}`)}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeletingCampaignId(c.id)}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Combine accounts (admin only) */}
        {canMerge && (
          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-amber-600" />
                Consolidate with another account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Move all campaigns, knowledge base documents, channel credentials, and sub-accounts from
                <strong> {account.practice_name || 'this account'}</strong> into a target account. The source
                account will be permanently removed once the merge completes.
              </p>
              <div className="flex gap-2">
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select target business account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherBusinesses.map((b: any) => (
                      <SelectItem key={b.user_id} value={b.user_id}>
                        {b.practice_name || 'Unnamed'} {b.email ? `(${b.email})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="default"
                  disabled={!mergeTargetId || merging}
                  onClick={() => setConfirmMerge(true)}
                >
                  <GitMerge className="w-4 h-4 mr-1" /> Combine
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danger zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete this account</p>
              <p className="text-sm text-muted-foreground">
                Permanently removes the account, all sub-accounts, campaigns, and knowledge base.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setConfirmDeleteAccount(true)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirm: delete sub */}
      <AlertDialog open={!!deletingSubId} onOpenChange={(o) => !o && setDeletingSubId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sub-account?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the sub-account user. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const id = deletingSubId!;
                setDeletingSubId(null);
                const ok = await handleDeleteSubOrAccount(id);
                if (ok) refetchSubs();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: delete campaign */}
      <AlertDialog open={!!deletingCampaignId} onOpenChange={(o) => !o && setDeletingCampaignId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>This removes the campaign and all of its channels and posts.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingCampaignId && handleDeleteCampaign(deletingCampaignId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: delete account */}
      <AlertDialog open={confirmDeleteAccount} onOpenChange={setConfirmDeleteAccount}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{account.practice_name || 'this account'}</strong>, all of its
              sub-accounts, campaigns, knowledge base entries, and credentials. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmDeleteAccount(false);
                // Also purge subs first
                for (const s of subs) {
                  await handleDeleteSubOrAccount(s.user_id);
                }
                const ok = await handleDeleteSubOrAccount(userId!);
                if (ok) navigate('/admin');
              }}
            >
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: merge */}
      <AlertDialog open={confirmMerge} onOpenChange={setConfirmMerge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Combine accounts?</AlertDialogTitle>
            <AlertDialogDescription>
              All data from <strong>{account.practice_name || 'this account'}</strong> will be moved into{' '}
              <strong>{mergeTarget?.practice_name || 'the target account'}</strong>, and the source account
              will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge} disabled={merging}>
              {merging ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <GitMerge className="w-4 h-4 mr-1" />}
              Combine accounts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccountProfile;
