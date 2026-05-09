import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { platformLabels } from '@/lib/platformIcons';

interface Props {
  campaignId: string;
}

interface Slot {
  localId: string;
  existingId?: string; // channel_posts.id (channels) or array index marker (addons handled in-memory)
  date: string;
  time: string;
  title: string;
  removed?: boolean;
}

interface Group {
  kind: 'channel' | 'addon';
  refId: string; // channel id or addon id
  label: string;
  slots: Slot[];
}

const TIME_OPTIONS = ['06:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

const newLocalId = () => `local-${Math.random().toString(36).slice(2, 10)}`;

const CampaignScheduler: React.FC<Props> = ({ campaignId }) => {
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

  const [groups, setGroups] = useState<Group[]>([]);

  const startDate = campaign?.start_date ? new Date(campaign.start_date) : null;
  const endDate = campaign?.end_date ? new Date(campaign.end_date) : null;
  const minDate = startDate ? format(startDate, 'yyyy-MM-dd') : undefined;
  const maxDate = endDate ? format(endDate, 'yyyy-MM-dd') : undefined;
  const defaultDate = useMemo(
    () => startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    [startDate]
  );

  useEffect(() => {
    if (!campaign) return;

    const channelGroups: Group[] = (campaign.campaign_channels || []).map((ch: any) => {
      const slots: Slot[] = (ch.channel_posts || [])
        .filter((p: any) => p.scheduled_start)
        .sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
        .map((p: any) => {
          const dt = new Date(p.scheduled_start);
          return {
            localId: newLocalId(),
            existingId: p.id,
            date: format(dt, 'yyyy-MM-dd'),
            time: format(dt, 'HH:mm'),
            title: p.title || '',
          };
        });
      return {
        kind: 'channel',
        refId: ch.id,
        label: platformLabels[ch.platform as keyof typeof platformLabels] || ch.platform,
        slots,
      };
    });

    const addonGroups: Group[] = (addons as any[]).map((a) => {
      let parsed: any = {};
      try { parsed = a.notes ? JSON.parse(a.notes) : {}; } catch {}
      const list: any[] = Array.isArray(parsed.schedules)
        ? parsed.schedules
        : parsed.scheduled_at
          ? [{ scheduled_at: parsed.scheduled_at }]
          : [];
      const slots: Slot[] = list.map((s: any) => {
        const dt = new Date(s.scheduled_at);
        return {
          localId: newLocalId(),
          existingId: s.scheduled_at,
          date: format(dt, 'yyyy-MM-dd'),
          time: format(dt, 'HH:mm'),
          title: s.title || '',
        };
      });
      return {
        kind: 'addon',
        refId: a.id,
        label: a.addon_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        slots,
      };
    });

    setGroups([...channelGroups, ...addonGroups]);
  }, [campaign, addons]);

  const updateSlot = (groupIdx: number, slotId: string, patch: Partial<Slot>) => {
    setGroups(prev => prev.map((g, i) => i !== groupIdx ? g : ({
      ...g,
      slots: g.slots.map(s => s.localId === slotId ? { ...s, ...patch } : s),
    })));
  };

  const addSlot = (groupIdx: number) => {
    setGroups(prev => prev.map((g, i) => i !== groupIdx ? g : ({
      ...g,
      slots: [...g.slots, { localId: newLocalId(), date: defaultDate, time: '09:00', title: '' }],
    })));
  };

  const removeSlot = (groupIdx: number, slotId: string) => {
    setGroups(prev => prev.map((g, i) => i !== groupIdx ? g : ({
      ...g,
      slots: g.slots.map(s => s.localId === slotId ? { ...s, removed: true } : s),
    })));
  };

  const saveAll = useMutation({
    mutationFn: async () => {
      for (const g of groups) {
        if (g.kind === 'channel') {
          for (const s of g.slots) {
            if (s.removed) {
              if (s.existingId) {
                const { error } = await supabase.from('channel_posts').delete().eq('id', s.existingId);
                if (error) throw error;
              }
              continue;
            }
            const iso = new Date(`${s.date}T${s.time}:00`).toISOString();
            if (s.existingId) {
              const { error } = await supabase
                .from('channel_posts')
                .update({ scheduled_start: iso, status: 'scheduled', title: s.title || campaign?.name || 'Scheduled post' })
                .eq('id', s.existingId);
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from('channel_posts')
                .insert({
                  campaign_channel_id: g.refId,
                  title: s.title || campaign?.name || 'Scheduled post',
                  scheduled_start: iso,
                  status: 'scheduled',
                });
              if (error) throw error;
            }
          }
        } else {
          // addon: pack all non-removed slots into notes JSON
          const schedules = g.slots
            .filter(s => !s.removed)
            .map(s => ({
              scheduled_at: new Date(`${s.date}T${s.time}:00`).toISOString(),
              title: s.title || undefined,
            }));
          const notes = schedules.length > 0 ? JSON.stringify({ schedules }) : null;
          const { error } = await (supabase as any)
            .from('campaign_addons')
            .update({ notes })
            .eq('id', g.refId);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduler-campaign', campaignId] });
      qc.invalidateQueries({ queryKey: ['scheduler-addons', campaignId] });
      qc.invalidateQueries({ queryKey: ['campaign-with-channels', campaignId] });
      qc.invalidateQueries({ queryKey: ['campaign-addons', campaignId] });
      toast.success('Schedule saved');
    },
    onError: (e: Error) => toast.error('Failed to save schedule', { description: e.message }),
  });

  if (isLoading) {
    return <div className="p-6 rounded-2xl bg-card border border-border">Loading campaign…</div>;
  }
  if (!campaign) {
    return <div className="p-6 rounded-2xl bg-card border border-border">Campaign not found.</div>;
  }

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
              ? `Window: ${format(startDate, 'MMM d, yyyy')} — ${format(endDate, 'MMM d, yyyy')}`
              : 'No campaign window set'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/campaign/${campaignId}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaign
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No channels or vectors selected for this campaign yet.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g, gi) => {
            const visibleSlots = g.slots.filter(s => !s.removed);
            return (
              <div key={`${g.kind}-${g.refId}`} className="rounded-xl border border-border p-4 bg-accent/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{g.label}</span>
                    {g.kind === 'addon' && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">Vector</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {visibleSlots.length} {visibleSlots.length === 1 ? 'post' : 'posts'} scheduled
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => addSlot(gi)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Post
                  </Button>
                </div>

                {visibleSlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No posts scheduled. Click "Add Post" to schedule one.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 px-1 text-[11px] font-medium text-muted-foreground">
                      <div className="col-span-4">Post Title (optional)</div>
                      <div className="col-span-4">Date</div>
                      <div className="col-span-3">Time</div>
                      <div className="col-span-1"></div>
                    </div>
                    {visibleSlots.map((s) => (
                      <div key={s.localId} className="grid grid-cols-12 gap-2 items-center bg-card rounded-lg p-2 border border-border/60">
                        <div className="col-span-4">
                          <Input
                            value={s.title}
                            placeholder="Post title"
                            onChange={(e) => updateSlot(gi, s.localId, { title: e.target.value })}
                          />
                        </div>
                        <div className="col-span-4">
                          <Input
                            type="date"
                            value={s.date}
                            min={minDate}
                            max={maxDate}
                            onChange={(e) => updateSlot(gi, s.localId, { date: e.target.value })}
                          />
                        </div>
                        <div className="col-span-3">
                          <Select value={s.time} onValueChange={(v) => updateSlot(gi, s.localId, { time: v })}>
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
                        <div className="col-span-1 flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeSlot(gi, s.localId)}
                            title="Remove this post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end pt-1">
            <Button onClick={() => saveAll.mutate()} disabled={saveAll.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {saveAll.isPending ? 'Saving…' : 'Save Schedule'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignScheduler;
