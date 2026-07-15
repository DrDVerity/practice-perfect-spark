import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Upload, Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DistributionList {
  id: string;
  name: string;
  source: 'existing' | 'import' | 'pms';
  row_count: number;
  status: string;
}

const GENERAL_TEST_VALUE = '__general_test__';

interface Props {
  channelId: string;
  campaignId?: string;
  currentListId?: string | null;
  currentMode?: string | null;
}

export default function EmailDistributionSelector({ channelId, campaignId, currentListId, currentMode }: Props) {
  const { user } = useAuth();
  const [lists, setLists] = useState<DistributionList[]>([]);
  const initialValue = currentMode === 'general_test' ? GENERAL_TEST_VALUE : (currentListId || '');
  const [value, setValue] = useState<string>(initialValue);

  const [showImport, setShowImport] = useState(false);
  const [showPms, setShowPms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pmsQuery, setPmsQuery] = useState('');
  const [pmsName, setPmsName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('email_distribution_lists')
      .select('id,name,source,row_count,status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setLists((data as DistributionList[]) || []);
  };

  useEffect(() => { load(); }, [user?.id]);
  useEffect(() => {
    setValue(currentMode === 'general_test' ? GENERAL_TEST_VALUE : (currentListId || ''));
  }, [currentListId, currentMode]);

  const persistSelection = async (listId: string | null, mode: string | null = null) => {
    const { error } = await supabase
      .from('campaign_channels')
      .update({ distribution_list_id: listId, distribution_list_mode: mode } as any)
      .eq('id', channelId);
    if (error) toast.error('Could not save list selection', { description: error.message });
    else toast.success(
      mode === 'general_test' ? 'Using general email list (test only)'
      : listId ? 'List selected' : 'List cleared'
    );
  };

  const handleSelect = (v: string) => {
    if (v === '__import__') { setShowImport(true); return; }
    if (v === '__pms__') { setShowPms(true); return; }
    if (v === GENERAL_TEST_VALUE) {
      setValue(GENERAL_TEST_VALUE);
      persistSelection(null, 'general_test');
      return;
    }
    setValue(v);
    persistSelection(v || null, null);
  };


  const handleFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const path = `distribution-lists/${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('kb-files').upload(path, file);
      if (upErr) throw upErr;
      // Naive row count estimate for CSV
      let rowCount = 0;
      try {
        const text = await file.text();
        rowCount = Math.max(0, text.split(/\r?\n/).filter(Boolean).length - 1);
      } catch { /* ignore */ }
      const { data: row, error: insErr } = await supabase
        .from('email_distribution_lists')
        .insert({
          user_id: user.id,
          campaign_id: campaignId || null,
          name: file.name.replace(/\.[^.]+$/, ''),
          source: 'import',
          row_count: rowCount,
          storage_path: path,
          status: 'ready',
        } as any)
        .select('id')
        .single();
      if (insErr) throw insErr;
      toast.success('List imported');
      setShowImport(false);
      await load();
      setValue(row!.id);
      await persistSelection(row!.id);
    } catch (e: any) {
      toast.error('Import failed', { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const submitPms = async () => {
    if (!user || !pmsName.trim() || !pmsQuery.trim()) return;
    setBusy(true);
    try {
      const { data: row, error } = await supabase
        .from('email_distribution_lists')
        .insert({
          user_id: user.id,
          campaign_id: campaignId || null,
          name: pmsName.trim(),
          source: 'pms',
          pms_query: pmsQuery.trim(),
          status: 'pending',
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      toast.success('PMS list requested — you will be notified when ready');
      setShowPms(false);
      setPmsName(''); setPmsQuery('');
      await load();
      setValue(row!.id);
      await persistSelection(row!.id);
    } catch (e: any) {
      toast.error('Request failed', { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const currentLabel = useMemo(() => {
    const l = lists.find(l => l.id === value);
    return l ? `${l.name} (${l.row_count})` : 'Select distribution list…';
  }, [lists, value]);

  return (
    <>
      <div className="flex items-center gap-2 w-full max-w-md">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Distribution list</Label>
        <Select value={value} onValueChange={handleSelect}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select distribution list…">{currentLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {lists.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No lists yet</div>
            )}
            {lists.map(l => (
              <SelectItem key={l.id} value={l.id}>
                {l.name} · {l.row_count} · {l.source}
              </SelectItem>
            ))}
            <SelectItem value="__import__"><Upload className="w-3 h-3 inline mr-1" /> Import list…</SelectItem>
            <SelectItem value="__pms__"><Database className="w-3 h-3 inline mr-1" /> Request new list from PMS…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Import dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import distribution list</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a CSV, Google Sheet export, or Excel file. First row should be column headers.
            </p>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)} disabled={busy}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PMS dialog */}
      <Dialog open={showPms} onOpenChange={setShowPms}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request new list from PMS</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>List name</Label>
              <Input value={pmsName} onChange={(e) => setPmsName(e.target.value)} placeholder="e.g. Treatment planned crowns" />
            </div>
            <div>
              <Label>SQL query for the PMS</Label>
              <Textarea rows={5} value={pmsQuery} onChange={(e) => setPmsQuery(e.target.value)} placeholder="SELECT patient_id, email FROM ..." />
            </div>
            <p className="text-xs text-muted-foreground">
              The query is queued. Once the PMS returns a CSV, the list will be attached automatically.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPms(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submitPms} disabled={busy || !pmsName.trim() || !pmsQuery.trim()}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Queue request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
