import React, { useMemo } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { useCampaignFinancials } from '@/hooks/useCampaignMetrics';
import { KPI_BRAND } from '@/lib/kpiColors';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  campaignIds: string[];
}

/**
 * Annual area chart of monthly marketing investment vs. return.
 * Return is derived from campaign_financials.revenue (new_patients * avg_patient_value).
 * Render order (back to front): Cumulative Net, Investment, Return.
 */
const AnnualROIChart: React.FC<Props> = ({ campaignIds }) => {
  const { resolvedTheme } = useTheme();
  const investmentColor = resolvedTheme === 'dark' ? KPI_BRAND.navyLight : KPI_BRAND.navy;
  const { data: rows = [], isLoading } = useCampaignFinancials(campaignIds);

  const data = useMemo(() => {
    // Build a rolling 12-month window ending this month.
    const now = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7)); // YYYY-MM
    }
    const totals: Record<string, { month: string; spend: number; revenue: number }> = {};
    for (const m of months) totals[m] = { month: m, spend: 0, revenue: 0 };
    for (const r of rows) {
      const key = String(r.month).slice(0, 7);
      if (!totals[key]) continue;
      totals[key].spend += Number(r.spend) || 0;
      totals[key].revenue += Number(r.revenue) || 0;
    }
    let cumNet = 0;
    return months.map((m) => {
      cumNet += totals[m].revenue - totals[m].spend;
      const label = new Date(m + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      return { ...totals[m], label, netCumulative: cumNet };
    });
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Investment vs. Return — trailing 12 months</CardTitle>
      </CardHeader>
      <CardContent className="h-[360px]">
        {isLoading ? (
          <Skeleton className="w-full h-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                formatter={(v: any) => `$${Number(v).toLocaleString()}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {/* Back: cumulative net */}
              <Area
                type="monotone"
                dataKey="netCumulative"
                name="Cumulative Net"
                stroke={KPI_BRAND.success}
                fill={KPI_BRAND.success}
                fillOpacity={0.2}
                strokeWidth={2}
              />
              {/* Middle: investment */}
              <Area
                type="monotone"
                dataKey="spend"
                name="Investment"
                stroke={investmentColor}
                fill={investmentColor}
                fillOpacity={0.5}
                strokeWidth={2}
              />
              {/* Front: return */}
              <Area
                type="monotone"
                dataKey="revenue"
                name="Return"
                stroke={KPI_BRAND.gold}
                fill={KPI_BRAND.gold}
                fillOpacity={0.7}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnualROIChart;
