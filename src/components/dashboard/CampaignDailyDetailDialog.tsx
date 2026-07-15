import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { useCampaignDailyMetrics } from '@/hooks/useCampaignMetrics';
import { platformColor, platformLabel } from '@/lib/kpiColors';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
}

type Metric = 'views' | 'clicks' | 'impressions' | 'leads';

/** Line chart per platform for the selected metric. */
const CampaignDailyDetailDialog: React.FC<Props> = ({ open, onOpenChange, campaignId, campaignName }) => {
  const { data: rows = [], isLoading } = useCampaignDailyMetrics(campaignId);
  const [metric, setMetric] = useState<Metric>('views');

  const { series, platforms } = useMemo(() => {
    const platformSet = new Set<string>();
    const byDay: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      platformSet.add(r.platform);
      byDay[r.date] ??= { date: r.date } as any;
      byDay[r.date][r.platform] = (byDay[r.date][r.platform] || 0) + (r[metric] || 0);
    }
    const s = Object.values(byDay).sort((a: any, b: any) => a.date.localeCompare(b.date));
    return { series: s, platforms: Array.from(platformSet) };
  }, [rows, metric]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{campaignName} — Daily platform activity</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-end mb-2">
          <ToggleGroup
            type="single"
            value={metric}
            onValueChange={(v) => v && setMetric(v as Metric)}
            size="sm"
          >
            <ToggleGroupItem value="views">Views</ToggleGroupItem>
            <ToggleGroupItem value="clicks">Clicks</ToggleGroupItem>
            <ToggleGroupItem value="impressions">Impressions</ToggleGroupItem>
            <ToggleGroupItem value="leads">Leads</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="h-[420px]">
          {isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : series.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No data available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {platforms.map((p) => (
                  <Line
                    key={p}
                    type="monotone"
                    dataKey={p}
                    name={platformLabel(p)}
                    stroke={platformColor(p)}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignDailyDetailDialog;
