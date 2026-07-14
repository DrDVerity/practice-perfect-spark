import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CalendarDays, ArrowLeft, Plus, Trash2, Save, ChevronLeft, ChevronRight, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, isSameDay, isSameMonth, parseISO, differenceInCalendarDays,
} from 'date-fns';
import { platformLabels } from '@/lib/platformIcons';

interface Props {
  campaignId: string;
  embedded?: boolean;
  onScheduleChanged?: () => void | Promise<void>;
}

interface Slot {
  localId: string;
  groupKey: string; // `${kind}:${refId}`
  kind: 'channel' | 'addon';
  refId: string;
  groupLabel: string;
  existingId?: string;
  date: string;
  time: string;
  title: string;
}

const TIME_OPTIONS = ['06:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
const newLocalId = () => `local-${Math.random().toString(36).slice(2, 10)}`;

// Channel/platform color map (per user spec)
const PLATFORM_COLORS: Record<string, string> = {
  linkedin: '#1d4ed8',
  instagram: '#f97316',
  facebook: '#ec4899',
  twitter: '#000000',
  youtube: '#dc2626',
  tiktok: '#0f172a',
  mailchimp: '#eab308',
  beehive: '#d97706',
  internal_email: '#0ea5e9',
  internal_sms: '#16a34a',
};
const VECTOR_PALETTE = ['#a855f7', '#14b8a6', '#f59e0b', '#ef4444', '#6366f1', '#db2777'];

const colorForGroup = (kind: 'channel' | 'addon', key: string, vectorIdx: number) => {
  if (kind === 'channel') return PLATFORM_COLORS[key] || '#64748b';
  return VECTOR_PALETTE[vectorIdx % VECTOR_PALETTE.length];
};

const toDateKey = (value: Date | string | null | undefined) => {
  if (!value) return null;
  return format(typeof value === 'string' ? new Date(value) : value, 'yyyy-MM-dd');
};

const combineLocalDateTime = (date: string, time: string) => new Date(`${date}T${time || '09:00'}:00`);

const CampaignScheduler: React.FC<Props> = ({ campaignId, embedded = false, onScheduleChanged }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['scheduler-campaign', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`*, campaign_channels(*, channel_posts(*))`)
        .eq('id', campaignId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: addons = [] } = useQuery({
    queryKey: ['scheduler-addons', campaignId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('campaign_addons')
        .select('*')
        .eq('campaign_id', campaignId);
      if (error) throw error;
      return data || [];
    },
  });

  const [slots, setSlots] = useState<Slot[]>([]);
  const [groupColors, setGroupColors] = useState<Record<string, { color: string; label: string; kind: 'channel' | 'addon'; refId: string; platformKey?: string }>>({});

  const startDate = campaign?.start_date ? new Date(campaign.start_date) : null;
  const endDate = campaign?.end_date ? new Date(campaign.end_date) : null;
  const minDate = toDateKey(startDate) || undefined;
  const maxDate = toDateKey(endDate) || undefined;

  const [viewMonth, setViewMonth] = useState<Date>(startDate || new Date());
  useEffect(() => { if (startDate) setViewMonth(startDate); /* eslint-disable-next-line */ }, [campaign?.start_date]);

  useEffect(() => {
    if (!campaign) return;

    const colors: typeof groupColors = {};
    const all: Slot[] = [];

    (campaign.campaign_channels || []).forEach((ch: any) => {
      const key = `channel:${ch.id}`;
      const platformKey = String(ch.platform).toLowerCase();
      colors[key] = {
        color: colorForGroup('channel', platformKey, 0),
        label: platformLabels[ch.platform as keyof typeof platformLabels] || ch.platform,
        kind: 'channel',
        refId: ch.id,
        platformKey,
      };
      (ch.channel_posts || [])
        .filter((p: any) => p.scheduled_start)
        .forEach((p: any) => {
          const dt = new Date(p.scheduled_start);
          all.push({
            localId: newLocalId(),
            groupKey: key,
            kind: 'channel',
            refId: ch.id,
            groupLabel: colors[key].label,
            existingId: p.id,
            date: format(dt, 'yyyy-MM-dd'),
            time: format(dt, 'HH:mm'),
            title: p.title || '',
          });
        });
    });

    (addons as any[]).forEach((a, idx) => {
      const key = `addon:${a.id}`;
      const label = a.addon_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      colors[key] = {
        color: colorForGroup('addon', key, idx),
        label,
        kind: 'addon',
        refId: a.id,
      };
      let parsed: any = {};
      try { parsed = a.notes ? JSON.parse(a.notes) : {}; } catch {}
      const list: any[] = Array.isArray(parsed.schedules)
        ? parsed.schedules
        : parsed.scheduled_at ? [{ scheduled_at: parsed.scheduled_at }] : [];
      list.forEach((s: any) => {
        const dt = new Date(s.scheduled_at);
        all.push({
          localId: newLocalId(),
          groupKey: key,
          kind: 'addon',
          refId: a.id,
          groupLabel: label,
          existingId: s.scheduled_at,
          date: format(dt, 'yyyy-MM-dd'),
          time: format(dt, 'HH:mm'),
          title: s.title || '',
        });
      });
    });

    setGroupColors(colors);
    setSlots(all.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
  }, [campaign, addons]);

  // Build month grid days
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    const days: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [viewMonth]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    slots.forEach(s => { (map[s.date] ||= []).push(s); });
    return map;
  }, [slots]);

  // Edit dialog state
  const [editing, setEditing] = useState<Slot | null>(null);
  const [creating, setCreating] = useState(false);

  const persistSlot = useMutation({
    mutationFn: async (slot: Slot) => {
      const iso = new Date(`${slot.date}T${slot.time}:00`).toISOString();
      if (slot.kind === 'channel') {
        if (slot.existingId) {
          const { error } = await supabase
            .from('channel_posts')
            .update({ scheduled_start: iso, status: 'scheduled', title: slot.title || campaign?.name || 'Scheduled post' })
            .eq('id', slot.existingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('channel_posts')
            .insert({
              campaign_channel_id: slot.refId,
              title: slot.title || campaign?.name || 'Scheduled post',
              scheduled_start: iso,
              status: 'scheduled',
            });
          if (error) throw error;
        }
      } else {
        // Rebuild addon notes JSON from current slots
        const addonSlots = slots
          .filter(s => s.groupKey === slot.groupKey && s.localId !== slot.localId)
          .concat([{ ...slot }])
          .map(s => ({
            scheduled_at: new Date(`${s.date}T${s.time}:00`).toISOString(),
            title: s.title || undefined,
          }));
        const { error } = await (supabase as any)
          .from('campaign_addons')
          .update({ notes: JSON.stringify({ schedules: addonSlots }) })
          .eq('id', slot.refId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduler-campaign', campaignId] });
      qc.invalidateQueries({ queryKey: ['scheduler-addons', campaignId] });
      toast.success('Post saved');
      setEditing(null);
      setCreating(false);
    },
    onError: (e: Error) => toast.error('Failed to save', { description: e.message }),
  });

  const deleteSlot = useMutation({
    mutationFn: async (slot: Slot) => {
      if (slot.kind === 'channel') {
        if (slot.existingId) {
          const { error } = await supabase.from('channel_posts').delete().eq('id', slot.existingId);
          if (error) throw error;
        }
      } else {
        const remaining = slots
          .filter(s => s.groupKey === slot.groupKey && s.localId !== slot.localId)
          .map(s => ({
            scheduled_at: new Date(`${s.date}T${s.time}:00`).toISOString(),
            title: s.title || undefined,
          }));
        const notes = remaining.length ? JSON.stringify({ schedules: remaining }) : null;
        const { error } = await (supabase as any)
          .from('campaign_addons')
          .update({ notes })
          .eq('id', slot.refId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduler-campaign', campaignId] });
      qc.invalidateQueries({ queryKey: ['scheduler-addons', campaignId] });
      toast.success('Post deleted');
      setEditing(null);
    },
    onError: (e: Error) => toast.error('Failed to delete', { description: e.message }),
  });

  // -------- Selection + drag-and-drop rescheduling --------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragIds, setDragIds] = useState<string[] | null>(null);
  const [dragAnchorDate, setDragAnchorDate] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const bulkMove = useMutation({
    mutationFn: async (payload: { moves: { slot: Slot; newDate: string; newTime?: string }[] }) => {
      const { moves } = payload;
      // Channel post updates (one per moved post).
      const channelMoves = moves.filter(m => m.slot.kind === 'channel' && m.slot.existingId);
      for (const m of channelMoves) {
        const iso = combineLocalDateTime(m.newDate, m.newTime || m.slot.time).toISOString();
        const { error } = await supabase
          .from('channel_posts')
          .update({ scheduled_start: iso, status: 'scheduled' })
          .eq('id', m.slot.existingId!);
        if (error) throw error;
      }
      // Addon groups: rebuild notes JSON for each affected addon.
      const addonMoves = moves.filter(m => m.slot.kind === 'addon');
      const byAddon: Record<string, { slot: Slot; newDate: string }[]> = {};
      for (const m of addonMoves) (byAddon[m.slot.refId] ||= []).push(m);
      for (const refId of Object.keys(byAddon)) {
        const groupSlots = slots.filter(s => s.kind === 'addon' && s.refId === refId);
        const moveMap = new Map(byAddon[refId].map(m => [m.slot.localId, m.newDate]));
        const rebuilt = groupSlots.map(s => {
          const nd = moveMap.get(s.localId) || s.date;
          const moved = byAddon[refId].find(m => m.slot.localId === s.localId);
          return {
            scheduled_at: combineLocalDateTime(nd, moved?.newTime || s.time).toISOString(),
            title: s.title || undefined,
          };
        });
        const { error } = await (supabase as any)
          .from('campaign_addons')
          .update({ notes: JSON.stringify({ schedules: rebuilt }) })
          .eq('id', refId);
        if (error) throw error;
      }
    },
    onSuccess: async (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['scheduler-campaign', campaignId] });
      qc.invalidateQueries({ queryKey: ['scheduler-addons', campaignId] });
      toast.success(`${vars.moves.length} post${vars.moves.length === 1 ? '' : 's'} rescheduled`);
      clearSelection();
      await onScheduleChanged?.();
    },
    onError: (e: Error) => toast.error('Failed to reschedule', { description: e.message }),
  });

  const fitCampaign = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) throw new Error('Campaign window is not set. Add start and end dates first.');
      const sorted = [...slots].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      if (sorted.length === 0) return;
      const startKey = toDateKey(startDate)!;
      const endKey = toDateKey(endDate)!;
      const windowStart = new Date(`${startKey}T00:00:00`);
      const windowEnd = new Date(`${endKey}T00:00:00`);
      const span = Math.max(0, differenceInCalendarDays(windowEnd, windowStart));
      // Distribute evenly; for a single post, place it on the start date.
      const moves: { slot: Slot; newDate: string; newTime?: string }[] = sorted.map((s, i) => {
        const offset = sorted.length === 1
          ? 0
          : Math.round((i * span) / (sorted.length - 1));
        const newDate = format(addDays(windowStart, offset), 'yyyy-MM-dd');
        const newTime = newDate === startKey && s.time < '06:00' ? '06:00' : s.time;
        return { slot: s, newDate, newTime };
      });
      await bulkMove.mutateAsync({ moves });
    },
    onError: (e: Error) => toast.error('Fit Campaign failed', { description: e.message }),
  });

  const handleDropOnDate = (dateStr: string) => {
    if (!dragIds || !dragAnchorDate) return;
    const anchor = new Date(dragAnchorDate);
    const target = new Date(dateStr);
    const delta = differenceInCalendarDays(target, anchor);
    if (delta === 0) {
      setDragIds(null); setDragAnchorDate(null); setDragOverDate(null);
      return;
    }
    const draggingSlots = slots.filter(s => dragIds.includes(s.localId));
    const startKey = minDate;
    const endKey = maxDate;
    const moves = draggingSlots.map(s => {
      const nd = format(addDays(new Date(s.date), delta), 'yyyy-MM-dd');
      // Clamp to campaign window if defined.
      const clamped = (() => {
        const d = new Date(nd);
        if (startDate && d < startDate) return format(startDate, 'yyyy-MM-dd');
        if (endDate && d > endDate) return format(endDate, 'yyyy-MM-dd');
        return nd;
      })();
      const newTime = clamped === startKey && s.time < '06:00' ? '06:00' : s.time;
      return { slot: s, newDate: clamped, newTime };
    });
    bulkMove.mutate({ moves });
    setDragIds(null); setDragAnchorDate(null); setDragOverDate(null);
  };

  if (isLoading) return <div className="p-6 rounded-2xl bg-card border border-border">Loading campaign…</div>;
  if (!campaign) return <div className="p-6 rounded-2xl bg-card border border-border">Campaign not found.</div>;

  const groupKeys = Object.keys(groupColors);
  const canPrev = startDate ? viewMonth > startOfMonth(startDate) : true;
  const canNext = endDate ? viewMonth < startOfMonth(endDate) : true;

  const openCreate = (groupKey: string, dateStr?: string) => {
    const meta = groupColors[groupKey];
    if (!meta) return;
    setEditing({
      localId: newLocalId(),
      groupKey,
      kind: meta.kind,
      refId: meta.refId,
      groupLabel: meta.label,
      date: dateStr || format(startDate || new Date(), 'yyyy-MM-dd'),
      time: '09:00',
      title: '',
    });
    setCreating(true);
  };

  // Reorder slots for the day so each circle's number reflects ordering
  const numberedForDay = (dateStr: string) => slotsByDate[dateStr] || [];

  return (
    <div className="mb-6 p-6 rounded-2xl bg-card border border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Schedule for: {campaign.name}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {startDate && endDate
              ? `Window: ${format(startDate, 'MMM d, yyyy')}, ${format(endDate, 'MMM d, yyyy')}`
              : 'No campaign window set'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fitCampaign.mutate()}
            disabled={fitCampaign.isPending || bulkMove.isPending || slots.length === 0 || !startDate || !endDate}
            title="Redistribute all posts evenly across the campaign window"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {fitCampaign.isPending ? 'Fitting…' : 'Fit Campaign'}
          </Button>
          {!embedded && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/campaign/${campaignId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-foreground">
            <span className="font-semibold">{selected.size}</span> post{selected.size === 1 ? '' : 's'} selected
            <span className="text-muted-foreground ml-2">— drag any selected bubble to move the whole group</span>
          </span>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-2">
        Tip: drag a post to a new date to reschedule. Shift/Ctrl-click posts to select multiple, then drag any of them to move all at once.
      </p>

      {/* Month calendar */}
      <div className="rounded-xl border border-border p-4 bg-background mb-4">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={() => setViewMonth(addMonths(viewMonth, -1))} disabled={!canPrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="font-semibold text-foreground">{format(viewMonth, 'MMMM yyyy')}</h3>
          <Button variant="ghost" size="icon" onClick={() => setViewMonth(addMonths(viewMonth, 1))} disabled={!canNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((d) => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const inMonth = isSameMonth(d, viewMonth);
            const inWindow = (!startDate || d >= startOfMonth(startDate) ? true : false) &&
                             (!minDate || dateStr >= minDate) &&
                             (!maxDate || dateStr <= maxDate);
            const daySlots = numberedForDay(dateStr);
            // count per group to label circles
            const perGroupCounts: Record<string, number> = {};
            const isDropTarget = dragOverDate === dateStr && dragIds && dragIds.length > 0;
            return (
              <div
                key={dateStr}
                onDragOver={(e) => {
                  if (!dragIds) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverDate !== dateStr) setDragOverDate(dateStr);
                }}
                onDragLeave={() => { if (dragOverDate === dateStr) setDragOverDate(null); }}
                onDrop={(e) => { e.preventDefault(); handleDropOnDate(dateStr); }}
                className={`min-h-[68px] rounded-md border p-1 text-left transition-colors ${
                  inMonth ? 'bg-card border-border' : 'bg-muted/30 border-transparent text-muted-foreground'
                } ${inWindow && inMonth ? '' : 'opacity-60'} ${
                  isDropTarget ? 'ring-2 ring-primary bg-primary/10' : ''
                }`}
              >
                <div className={`text-[11px] font-medium mb-1 ${isSameDay(d, new Date()) ? 'text-primary' : ''}`}>
                  {format(d, 'd')}
                </div>
                <div className="flex flex-wrap gap-1">
                  {daySlots.map((s) => {
                    perGroupCounts[s.groupKey] = (perGroupCounts[s.groupKey] || 0) + 1;
                    const num = perGroupCounts[s.groupKey];
                    const color = groupColors[s.groupKey]?.color || '#64748b';
                    const isSelected = selected.has(s.localId);
                    return (
                      <button
                        key={s.localId}
                        draggable
                        onDragStart={(e) => {
                          const ids = isSelected && selected.size > 1
                            ? Array.from(selected)
                            : [s.localId];
                          setDragIds(ids);
                          setDragAnchorDate(s.date);
                          e.dataTransfer.effectAllowed = 'move';
                          try { e.dataTransfer.setData('text/plain', ids.join(',')); } catch {}
                        }}
                        onDragEnd={() => { setDragIds(null); setDragAnchorDate(null); setDragOverDate(null); }}
                        onClick={(e) => {
                          if (e.shiftKey || e.metaKey || e.ctrlKey) {
                            e.preventDefault();
                            toggleSelect(s.localId);
                            return;
                          }
                          setEditing(s); setCreating(false);
                        }}
                        title={`${s.groupLabel} • ${s.time}${s.title ? ` • ${s.title}` : ''}\nDrag to reschedule. Shift-click to multi-select.`}
                        className={`rounded-full w-5 h-5 text-[10px] font-bold text-white flex items-center justify-center transition-transform shadow-sm cursor-grab active:cursor-grabbing hover:scale-110 ${
                          isSelected ? 'ring-2 ring-offset-1 ring-primary scale-110' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {groupKeys.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border">
            {groupKeys.map((k) => {
              const meta = groupColors[k];
              const count = slots.filter(s => s.groupKey === k).length;
              return (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="font-medium text-foreground">{meta.label}</span>
                  {meta.kind === 'addon' && <Badge variant="outline" className="text-[9px] px-1 py-0">Vector</Badge>}
                  <span className="text-muted-foreground">({count})</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Simple posts table */}
      {groupKeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No channels or vectors selected for this campaign yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
            <h3 className="font-semibold text-sm text-foreground">Scheduled Posts</h3>
            <Select onValueChange={(v) => openCreate(v)}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <div className="flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> <span>Add post to…</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {groupKeys.map(k => (
                  <SelectItem key={k} value={k}>{groupColors[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2 w-[220px]">Channel / Vector</th>
                <th className="text-left font-medium px-4 py-2">Title</th>
                <th className="text-left font-medium px-4 py-2 w-[140px]">Date</th>
                <th className="text-left font-medium px-4 py-2 w-[100px]">Time</th>
              </tr>
            </thead>
            <tbody>
              {slots.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">
                    No posts scheduled yet. Use "Add post to…" above to create one.
                  </td>
                </tr>
              ) : (
                slots.map((s) => {
                  const color = groupColors[s.groupKey]?.color || '#64748b';
                  return (
                    <tr
                      key={s.localId}
                      onClick={() => { setEditing(s); setCreating(false); }}
                      className="border-t border-border cursor-pointer hover:bg-accent/40 transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="font-medium text-foreground">{s.groupLabel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{s.title || <span className="text-muted-foreground italic">Untitled</span>}</td>
                      <td className="px-4 py-2.5 text-foreground">{format(parseISO(s.date), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-2.5 text-foreground">{format(new Date(`2000-01-01T${s.time}`), 'h:mm a')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {creating ? 'Schedule new post' : 'Edit scheduled post'}
            </DialogTitle>
            <DialogDescription>
              {editing && (
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: groupColors[editing.groupKey]?.color }} />
                  {editing.groupLabel}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Post title (optional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <Input
                    type="date"
                    value={editing.date}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Time</label>
                  <Select value={editing.time} onValueChange={(v) => setEditing({ ...editing, time: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map(t => (
                        <SelectItem key={t} value={t}>
                          {format(new Date(`2000-01-01T${t}`), 'h:mm a')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {editing && !creating && editing.existingId && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => editing && deleteSlot.mutate(editing)}
                  disabled={deleteSlot.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>
                Cancel
              </Button>
              <Button
                onClick={() => editing && persistSlot.mutate(editing)}
                disabled={persistSlot.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {persistSlot.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignScheduler;
