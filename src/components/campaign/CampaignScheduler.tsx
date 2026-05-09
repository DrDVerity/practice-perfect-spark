import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { platformLabels, platformColors } from '@/lib/platformIcons';

interface Props {
  campaignId: string;
}

interface ScheduleRow {
  key: string;
  kind: 'channel' | 'addon';
  refId: string; // campaign_channel.id or addon.id
  label: string;
  badgeClass?: string;
  enabled: boolean;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  existingPostId?: string;
}

const TIME_OPTIONS = ['06:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

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

  const [rows, setRows] = useState<ScheduleRow[]>([]);

  const startDate = campaign?.start_date ? new Date(campaign.start_date) : null;
  const endDate = campaign?.end_date ? new Date(campaign.end_date) : null;
  const minDate = startDate ? format(startDate, 'yyyy-MM-dd') : undefined;
  const maxDate = endDate ? format(endDate, 'yyyy-MM-dd') : undefined;

  useEffect(() => {
    if (!campaign) return;
    const defaultDate = startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

    const channelRows: ScheduleRow[] = (campaign.campaign_channels || []).map((ch: any) => {
      const scheduledPost = (ch.channel_posts || []).find((p: any) => p.scheduled_start);
      const dt = scheduledPost?.scheduled_start ? new Date(scheduledPost.scheduled_start) : null;
      return {
        key: `ch-${ch.id}`,
        kind: 'channel',
        refId: ch.id,
        label: platformLabels[ch.platform as keyof typeof platformLabels] || ch.platform,
        badgeClass: (platformColors[ch.platform as keyof typeof platformColors] || 'bg-primary text-white').split(' ').slice(0, -1).join(' '),
        enabled: !!scheduledPost,
        date: dt ? format(dt, 'yyyy-MM-dd') : defaultDate,
        time: dt ? format(dt, 'HH:mm') : '09:00',
        existingPostId: scheduledPost?.id,
      };
    });

    const addonRows: ScheduleRow[] = (addons as any[]).map((a) => {
      let parsed: { scheduled_at?: string } = {};
      try { parsed = a.notes ? JSON.parse(a.notes) : {}; } catch {}
      const dt = parsed.scheduled_at ? new Date(parsed.scheduled_at) : null;
      return {
        key: `ad-${a.id}`,
        kind: 'addon',
        refId: a.id,
        label: a.addon_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        enabled: !!dt,
        date: dt ? format(dt, 'yyyy-MM-dd') : defaultDate,
        time: dt ? format(dt, 'HH:mm') : '09:00',
      };
    });

    setRows([...channelRows, ...addonRows]);
  }, [campaign, addons]);

  const updateRow = (key: string, patch: Partial<ScheduleRow>) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  };

  const saveAll = useMutation({
    mutationFn: async () => {
      for (const r of rows) {
        const iso = new Date(`${r.date}T${r.time}:00`).toISOString();
        if (r.kind === 'channel') {
          if (r.enabled) {
            if (r.existingPostId) {
              const { error } = await supabase
                .from('channel_posts')
                .update({ scheduled_start: iso, status: 'scheduled' })
                .eq('id', r.existingPostId);
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from('channel_posts')
                .insert({
                  campaign_channel_id: r.refId,
                  title: campaign?.name || 'Scheduled post',
                  scheduled_start: iso,
                  status: 'scheduled',
                });
              if (error) throw error;
            }
          } else if (r.existingPostId) {
            const { error } = await supabase
              .from('channel_posts')
              .update({ scheduled_start: null, status: 'draft' })
              .eq('id', r.existingPostId);
            if (error) throw error;
          }
        } else {
          // addon: store schedule in notes JSON
          const notes = r.enabled ? JSON.stringify({ scheduled_at: iso }) : null;
          const { error } = await (supabase as any)
            .from('campaign_addons')
            .update({ notes })
            .eq('id', r.refId);
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

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No channels or vectors selected for this campaign yet.</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-3 px-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-1">Post</div>
            <div className="col-span-4">Channel / Vector</div>
            <div className="col-span-4">Date</div>
            <div className="col-span-3">Time</div>
          </div>
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-12 gap-3 items-center px-2 py-3 rounded-lg bg-accent/40">
              <div className="col-span-1">
                <Checkbox
                  checked={r.enabled}
                  onCheckedChange={(v) => updateRow(r.key, { enabled: !!v })}
                />
              </div>
              <div className="col-span-4 flex items-center gap-2">
                <span className="font-medium text-sm text-foreground">{r.label}</span>
                {r.kind === 'addon' && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">Vector</Badge>
                )}
              </div>
              <div className="col-span-4">
                <Input
                  type="date"
                  value={r.date}
                  min={minDate}
                  max={maxDate}
                  disabled={!r.enabled}
                  onChange={(e) => updateRow(r.key, { date: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <Select value={r.time} onValueChange={(v) => updateRow(r.key, { time: v })} disabled={!r.enabled}>
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
          ))}
          <div className="flex justify-end pt-3">
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
