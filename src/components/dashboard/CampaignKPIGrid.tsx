import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useCampaignKpiTotals } from '@/hooks/useCampaignMetrics';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, MousePointerClick, Users, CalendarCheck, DollarSign, TrendingUp } from 'lucide-react';

interface Props {
  campaignIds: string[];
}

const items = [
  { key: 'impressions', label: 'Impressions', icon: Eye, format: (v: number) => v.toLocaleString() },
  { key: 'clicks', label: 'Clicks', icon: MousePointerClick, format: (v: number) => v.toLocaleString() },
  { key: 'leads', label: 'Leads', icon: Users, format: (v: number) => v.toLocaleString() },
  { key: 'appointments', label: 'Appointments', icon: CalendarCheck, format: (v: number) => v.toLocaleString() },
  { key: 'spend', label: 'Ad Spend', icon: DollarSign, format: (v: number) => `$${Number(v).toLocaleString()}` },
] as const;

/** Summary KPI grid across all campaigns for the practice. */
const CampaignKPIGrid: React.FC<Props> = ({ campaignIds }) => {
  const { data, isLoading } = useCampaignKpiTotals(campaignIds);

  const totals = data || { impressions: 0, views: 0, clicks: 0, leads: 0, appointments: 0, spend: 0 };
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card key={it.key}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{it.label}</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-16" />
                ) : (
                  <p className="text-lg font-bold text-foreground truncate">
                    {it.format((totals as any)[it.key] || 0)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">CTR</p>
            {isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <p className="text-lg font-bold text-foreground">{ctr.toFixed(2)}%</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignKPIGrid;
