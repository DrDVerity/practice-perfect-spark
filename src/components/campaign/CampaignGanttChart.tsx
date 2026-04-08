import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { platformLabels, platformColors } from '@/lib/platformIcons';
import { format, differenceInDays, addDays } from 'date-fns';

interface GanttItem {
  id: string;
  label: string;
  start: Date;
  end: Date;
  color: string;
  type: 'channel' | 'addon';
}

interface CampaignGanttChartProps {
  campaignStart: Date;
  campaignEnd: Date;
  channels: { id: string; platform: string; channel_type: string; channel_posts?: { scheduled_start?: string | null; scheduled_end?: string | null }[] }[];
  addons?: { id: string; addon_type: string }[];
  budgetAllocations?: Record<string, { amount?: string; percent?: string }>;
}

const addonColors: Record<string, string> = {
  google_ads: 'bg-blue-500',
  lsa: 'bg-indigo-500',
  ppc: 'bg-cyan-500',
  influencer: 'bg-pink-500',
  direct_mail: 'bg-amber-600',
  radio: 'bg-purple-500',
  billboard: 'bg-teal-500',
  newspaper: 'bg-orange-500',
  tabloid: 'bg-rose-500',
  circulars: 'bg-lime-600',
};

const CampaignGanttChart: React.FC<CampaignGanttChartProps> = ({
  campaignStart,
  campaignEnd,
  channels,
  addons = [],
  budgetAllocations,
}) => {
  const totalDays = Math.max(differenceInDays(campaignEnd, campaignStart), 1);

  // Build items from channels
  const items: GanttItem[] = channels.map((ch) => {
    const posts = ch.channel_posts || [];
    const starts = posts.map(p => p.scheduled_start ? new Date(p.scheduled_start) : campaignStart);
    const ends = posts.map(p => p.scheduled_end ? new Date(p.scheduled_end) : campaignEnd);
    const earliest = starts.length > 0 ? new Date(Math.min(...starts.map(d => d.getTime()))) : campaignStart;
    const latest = ends.length > 0 ? new Date(Math.max(...ends.map(d => d.getTime()))) : campaignEnd;

    return {
      id: ch.id,
      label: platformLabels[ch.platform as keyof typeof platformLabels] || ch.platform,
      start: earliest < campaignStart ? campaignStart : earliest,
      end: latest > campaignEnd ? campaignEnd : latest,
      color: (platformColors[ch.platform as keyof typeof platformColors] || 'bg-primary').split(' ')[0],
      type: 'channel' as const,
    };
  });

  // Add addon items spanning campaign duration
  addons.forEach((a) => {
    items.push({
      id: a.id,
      label: a.addon_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      start: campaignStart,
      end: campaignEnd,
      color: addonColors[a.addon_type] || 'bg-secondary',
      type: 'addon',
    });
  });

  // Generate week markers
  const weeks: Date[] = [];
  let d = new Date(campaignStart);
  while (d <= campaignEnd) {
    weeks.push(new Date(d));
    d = addDays(d, 7);
  }

  const getBarStyle = (item: GanttItem) => {
    const startOffset = Math.max(differenceInDays(item.start, campaignStart), 0);
    const duration = Math.max(differenceInDays(item.end, item.start), 1);
    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Campaign Schedule</CardTitle>
        <p className="text-sm text-muted-foreground">
          {format(campaignStart, 'MMM d, yyyy')} — {format(campaignEnd, 'MMM d, yyyy')} ({totalDays} days)
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Timeline header */}
          <div className="flex border-b border-border pb-1 mb-2">
            <div className="w-40 shrink-0 text-xs font-medium text-muted-foreground">Channel / Vector</div>
            <div className="flex-1 relative h-6">
              {weeks.map((w, i) => {
                const offset = (differenceInDays(w, campaignStart) / totalDays) * 100;
                return (
                  <div
                    key={i}
                    className="absolute text-[10px] text-muted-foreground"
                    style={{ left: `${offset}%` }}
                  >
                    {format(w, 'M/d')}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bars */}
          {items.map((item) => {
            const style = getBarStyle(item);
            const alloc = budgetAllocations?.[item.label.toLowerCase().replace(/ /g, '_')];
            return (
              <div key={item.id} className="flex items-center mb-1.5">
                <div className="w-40 shrink-0 flex items-center gap-2">
                  <span className="text-xs font-medium truncate">{item.label}</span>
                  {item.type === 'addon' && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">Vector</Badge>
                  )}
                </div>
                <div className="flex-1 relative h-7 bg-muted/30 rounded">
                  <div
                    className={`absolute top-0.5 bottom-0.5 rounded ${item.color} opacity-80`}
                    style={style}
                  >
                    {alloc && (
                      <span className="text-[9px] text-white px-1 whitespace-nowrap">
                        ${alloc.amount || '0'} ({alloc.percent || '0'}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Add channels and set dates to see the schedule.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CampaignGanttChart;
