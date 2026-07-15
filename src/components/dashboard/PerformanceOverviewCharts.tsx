import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { useCampaignMonthlyMetrics } from '@/hooks/useCampaignMetrics';
import { KPI_BRAND } from '@/lib/kpiColors';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  campaignIds: string[];
}

type MetricKey = 'appointments' | 'leads' | 'impressions' | 'clicks';

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'appointments', label: 'Appointments', color: KPI_BRAND.success },
  { key: 'leads', label: 'Leads', color: KPI_BRAND.navy },
  { key: 'impressions', label: 'Impressions', color: KPI_BRAND.gold },
  { key: 'clicks', label: 'Clicks', color: KPI_BRAND.azure },
];

const PerformanceOverviewCharts: React.FC<Props> = ({ campaignIds }) => {
  const { data: rows = [], isLoading } = useCampaignMonthlyMetrics(campaignIds);

  const data = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    const map: Record<string, { month: string; label: string; leads: number; impressions: number; clicks: number; appointments: number }> = {};
    for (const m of months) {
      map[m] = {
        month: m,
        label: new Date(m + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        leads: 0,
        impressions: 0,
        clicks: 0,
        appointments: 0,
      };
    }
    for (const r of rows) {
      const key = String(r.month).slice(0, 7);
      if (!map[key]) continue;
      map[key].leads += r.leads || 0;
      map[key].impressions += r.impressions || 0;
      map[key].clicks += r.clicks || 0;
      map[key].appointments += r.appointments || 0;
    }
    return months.map((m) => map[m]);
  }, [rows]);

  const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Performance overview — trailing 12 months</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="appointments">
          <TabsList>
            {METRICS.map((m) => (
              <TabsTrigger key={m.key} value={m.key}>{m.label}</TabsTrigger>
            ))}
          </TabsList>
          {METRICS.map((m) => (
            <TabsContent key={m.key} value={m.key} className="h-[320px] mt-4">
              {isLoading ? (
                <Skeleton className="w-full h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => Number(v).toLocaleString()} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey={m.key} name={m.label} fill={m.color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PerformanceOverviewCharts;
