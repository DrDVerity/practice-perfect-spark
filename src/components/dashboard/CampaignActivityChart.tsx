import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { useCampaignDailyMetrics } from '@/hooks/useCampaignMetrics';
import { KPI_BRAND } from '@/lib/kpiColors';
import CampaignDailyDetailDialog from './CampaignDailyDetailDialog';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  campaignId: string;
  campaignName: string;
}

/** Stacked-column chart of total views + clicks per day across all platforms. */
export const CampaignActivityChart: React.FC<Props> = ({ campaignId, campaignName }) => {
  const { data: rows = [], isLoading } = useCampaignDailyMetrics(campaignId);
  const [open, setOpen] = useState(false);

  const daily = useMemo(() => {
    const byMonth: Record<string, { date: string; label: string; views: number; clicks: number }> = {};
    for (const r of rows) {
      const month = String(r.date).slice(0, 7);
      if (!byMonth[month]) {
        byMonth[month] = {
          date: month,
          label: new Date(month + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
          views: 0,
          clicks: 0,
        };
      }
      byMonth[month].views += r.views || 0;
      byMonth[month].clicks += r.clicks || 0;
    }
    return Object.values(byMonth).sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const hasData = daily.length > 0;

  return (
    <>
      <Card
        className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
        onClick={() => hasData && setOpen(true)}
        title={hasData ? 'Click for platform breakdown' : 'No metrics yet'}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium truncate">{campaignName}</CardTitle>
        </CardHeader>
        <CardContent className="h-40">
          {isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : !hasData ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No activity data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="views" stackId="a" fill={KPI_BRAND.navy} name="Views" />
                <Bar dataKey="clicks" stackId="a" fill={KPI_BRAND.gold} name="Clicks" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <CampaignDailyDetailDialog
        open={open}
        onOpenChange={setOpen}
        campaignId={campaignId}
        campaignName={campaignName}
      />
    </>
  );
};

export default CampaignActivityChart;
