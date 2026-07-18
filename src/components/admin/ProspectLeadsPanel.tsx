import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Send, Trash2, Pencil, ListPlus, User } from 'lucide-react';

interface Prospect {
  id: string;
  email: string | null;
  practice_name: string | null;
  website_url: string | null;
  campaign_focus: string | null;
  target_audience: string | null;
  status: string | null;
  created_at: string | null;
}

type BulkAction = 'contact' | 'edit' | 'delete';

export default function ProspectLeadsPanel({ prospects }: { prospects: Prospect[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | ''>('');
  const [openContact, setOpenContact] = useState<Prospect | null>(null);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Prospect[] | null>(null);
  const [contactChoice, setContactChoice] = useState<Prospect[] | null>(null);

  const allChecked = prospects.length > 0 && selectedIds.size === prospects.length;
  const someChecked = selectedIds.size > 0 && !allChecked;

  const toggleAll = () => {
    setSelectedIds(allChecked ? new Set() : new Set(prospects.map((p) => p.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const selectedRows = useMemo(
    () => prospects.filter((p) => selectedIds.has(p.id)),
    [prospects, selectedIds],
  );

  const runBulkAction = () => {
    if (!bulkAction || selectedRows.length === 0) {
      toast.error('Pick an action and at least one row');
      return;
    }
    if (bulkAction === 'delete') setConfirmDelete(selectedRows);
    else if (bulkAction === 'edit') {
      if (selectedRows.length > 1) toast.info('Editing the first selected row.');
      setEditing(selectedRows[0]);
    } else if (bulkAction === 'contact') setContactChoice(selectedRows);
  };

  const doDelete = async (rows: Prospect[]) => {
    const ids = rows.map((r) => r.id);
    const { data, error } = await (supabase as any)
      .from('prospect_accounts')
      .delete()
      .in('id', ids)
      .select('id');
    if (error) return toast.error('Delete failed', { description: error.message });
    const removed = (data || []).length;
    if (removed === 0) {
      return toast.error('Nothing was deleted', {
        description: 'No rows were removed. You may not have permission to delete these leads.',
      });
    }
    toast.success(`Deleted ${removed} lead${removed === 1 ? '' : 's'}`);
    setSelectedIds(new Set());
    setConfirmDelete(null);
    qc.invalidateQueries({ queryKey: ['admin-prospect-leads'] });
  };

  const doSaveEdit = async (p: Prospect) => {
    const { error } = await (supabase as any)
      .from('prospect_accounts')
      .update({
        email: p.email, practice_name: p.practice_name,
        website_url: p.website_url, campaign_focus: p.campaign_focus,
        target_audience: p.target_audience,
      })
      .eq('id', p.id);
    if (error) return toast.error('Save failed', { description: error.message });
    toast.success('Lead updated');
    setEditing(null);
    qc.invalidateQueries({ queryKey: ['admin-prospect-leads'] });
  };

  const enrollInDrip = async (rows: Prospect[]) => {
    const emails = rows.map((r) => r.email).filter(Boolean) as string[];
    if (!emails.length) return toast.error('No email addresses on selected leads');
    // Mark the prospect as enrolled; nurture worker picks these up.
    const { error } = await (supabase as any)
      .from('prospect_accounts')
      .update({ status: 'drip_enrolled' })
      .in('id', rows.map((r) => r.id));
    if (error) return toast.error('Drip enroll failed', { description: error.message });
    toast.success(`Added ${emails.length} lead${emails.length === 1 ? '' : 's'} to the drip list`);
    setContactChoice(null);
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ['admin-prospect-leads'] });
  };

  const openDirectEmail = (rows: Prospect[]) => {
    // Multiple rows: send them as comma-separated recipients (composer accepts free text).
    const to = rows.map((r) => r.email).filter(Boolean).join(', ');
    const primary = rows[0];
    const prefill = {
      type: 'email' as const,
      recipient_type: 'client' as const,
      to,
      name: primary?.practice_name || primary?.email || '',
      subject: primary?.campaign_focus
        ? `Following up on your ${primary.campaign_focus} campaign`
        : 'Following up on your Archer campaign preview',
    };
    try {
      window.sessionStorage.setItem('archer:message-prefill', JSON.stringify({ savedAt: Date.now(), prefill }));
    } catch { /* route state still carries the prefill */ }
    navigate('/messages', {
      state: {
        prefill,
      },
    });
  };

  return (
    <>
      {/* Bulk action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {selectedIds.size} selected
        </span>
        <Select value={bulkAction} onValueChange={(v) => setBulkAction(v as BulkAction)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Bulk action…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contact"><Mail className="inline w-3.5 h-3.5 mr-2" />Contact</SelectItem>
            <SelectItem value="edit"><Pencil className="inline w-3.5 h-3.5 mr-2" />Edit</SelectItem>
            <SelectItem value="delete"><Trash2 className="inline w-3.5 h-3.5 mr-2" />Delete</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={runBulkAction} disabled={!bulkAction || selectedIds.size === 0}>
          Apply
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {prospects.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No unconverted prospect leads yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Practice</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Focus</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setOpenContact(p)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(p.id)}
                        onCheckedChange={() => toggleOne(p.id)}
                        aria-label={`Select ${p.email}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{p.email}</TableCell>
                    <TableCell>{p.practice_name || '—'}</TableCell>
                    <TableCell className="max-w-[240px] truncate">
                      {p.website_url ? (
                        <a
                          href={p.website_url} target="_blank" rel="noreferrer"
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.website_url.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{p.campaign_focus || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'ready' ? 'default' : 'secondary'}>{p.status || 'pending'}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Contact card */}
      <Dialog open={!!openContact} onOpenChange={(o) => !o && setOpenContact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              {openContact?.practice_name || openContact?.email || 'Contact'}
            </DialogTitle>
            <DialogDescription>Prospect lead details</DialogDescription>
          </DialogHeader>
          {openContact && (
            <div className="space-y-2 text-sm">
              <Row label="Email" value={openContact.email} />
              <Row label="Practice" value={openContact.practice_name} />
              <Row label="Website" value={openContact.website_url} link />
              <Row label="Campaign focus" value={openContact.campaign_focus} />
              <Row label="Target audience" value={openContact.target_audience} />
              <Row label="Status" value={openContact.status} />
              <Row label="Created" value={openContact.created_at ? new Date(openContact.created_at).toLocaleString() : null} />

              <div className="pt-3 border-t">
                <Label className="text-xs uppercase text-muted-foreground">Action</Label>
                <Select
                  onValueChange={(v) => {
                    const p = openContact;
                    setOpenContact(null);
                    if (v === 'contact') setContactChoice([p]);
                    else if (v === 'edit') setEditing(p);
                    else if (v === 'delete') setConfirmDelete([p]);
                  }}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose an action…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact"><Mail className="inline w-3.5 h-3.5 mr-2" />Contact</SelectItem>
                    <SelectItem value="edit"><Pencil className="inline w-3.5 h-3.5 mr-2" />Edit</SelectItem>
                    <SelectItem value="delete"><Trash2 className="inline w-3.5 h-3.5 mr-2" />Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contact type picker */}
      <Dialog open={!!contactChoice} onOpenChange={(o) => !o && setContactChoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contact {contactChoice?.length} lead{contactChoice?.length === 1 ? '' : 's'}</DialogTitle>
            <DialogDescription>Pick how you'd like to reach out.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              variant="outline" className="justify-start h-auto py-3"
              onClick={() => contactChoice && enrollInDrip(contactChoice)}
            >
              <ListPlus className="w-4 h-4 mr-2 text-primary" />
              <div className="text-left">
                <div className="font-medium">Add to drip list</div>
                <div className="text-xs text-muted-foreground">Enroll in the automated nurture sequence.</div>
              </div>
            </Button>
            <Button
              className="justify-start h-auto py-3"
              onClick={() => contactChoice && openDirectEmail(contactChoice)}
            >
              <Send className="w-4 h-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Direct email</div>
                <div className="text-xs opacity-80">Compose in the message center with recipient pre-filled.</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit lead</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Email" value={editing.email || ''} onChange={(v) => setEditing({ ...editing, email: v })} />
              <Field label="Practice name" value={editing.practice_name || ''} onChange={(v) => setEditing({ ...editing, practice_name: v })} />
              <Field label="Website" value={editing.website_url || ''} onChange={(v) => setEditing({ ...editing, website_url: v })} />
              <Field label="Campaign focus" value={editing.campaign_focus || ''} onChange={(v) => setEditing({ ...editing, campaign_focus: v })} />
              <Field label="Target audience" value={editing.target_audience || ''} onChange={(v) => setEditing({ ...editing, target_audience: v })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && doSaveEdit(editing)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.length} lead{confirmDelete?.length === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && doDelete(confirmDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Row({ label, value, link }: { label: string; value: string | null | undefined; link?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="col-span-2 break-words">
        {value
          ? link
            ? <a href={value} target="_blank" rel="noreferrer" className="text-primary hover:underline">{value}</a>
            : value
          : <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
