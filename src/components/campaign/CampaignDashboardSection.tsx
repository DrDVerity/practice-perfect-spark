import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { platformLabels, platformColors, platformIcons } from '@/lib/platformIcons';
import { CAMPAIGN_ADDONS } from '@/components/campaign/CampaignAddonDialog';
import { DollarSign } from 'lucide-react';

interface CampaignDashboardSectionProps {
  channels: { id: string; platform: string; channel_type: string; channel_posts?: any[] }[];
  addons: { id: string; addon_type: string }[];
  budget?: { total_amount: number; allocations: any; accepted: boolean } | null;
  customAddons?: { key: string; label: string; icon: string }[];
  onBudgetClick?: () => void;
  onChannelClick?: (channelId: string) => void;
  onAddonClick?: (addonType: string) => void;
}

const CampaignDashboardSection: React.FC<CampaignDashboardSectionProps> = ({
  channels,
  addons,
  budget,
  customAddons = [],
  onBudgetClick,
  onChannelClick,
  onAddonClick,
}) => {
  const allAddonDefs = [...CAMPAIGN_ADDONS, ...customAddons];
  const allocations = (budget?.allocations || {}) as Record<string, { amount?: string; percent?: string }>;
  const totalBudget = budget?.total_amount || 0;

  const allocated = Object.values(allocations).reduce((s, a) => s + (parseFloat(a.amount || '0') || 0), 0);
  const remaining = totalBudget - allocated;

  return (
    <div className="space-y-6">
      {/* Budget Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={onBudgetClick ? "cursor-pointer transition-all hover:shadow-md hover:border-primary/50" : ""}
          onClick={onBudgetClick}
          title={onBudgetClick ? "Click to edit total budget & allocations" : undefined}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Budget</p>
              <p className="text-xl font-bold text-foreground">${totalBudget.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={onBudgetClick ? "cursor-pointer transition-all hover:shadow-md hover:border-primary/50" : ""}
          onClick={onBudgetClick}
          title={onBudgetClick ? "Click to edit allocations" : undefined}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Allocated</p>
              <p className="text-xl font-bold text-foreground">${allocated.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={onBudgetClick ? "cursor-pointer transition-all hover:shadow-md hover:border-primary/50" : ""}
          onClick={onBudgetClick}
          title={onBudgetClick ? "Click to edit allocations" : undefined}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className={`text-xl font-bold ${remaining < 0 ? 'text-destructive' : 'text-foreground'}`}>
                ${remaining.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channels Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Campaign Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Posts</TableHead>
                <TableHead className="text-right">Budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((ch) => {
                const key = ch.platform;
                const alloc = allocations[key];
                return (
                  <TableRow key={ch.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${platformColors[ch.platform as keyof typeof platformColors] || 'bg-muted'}`}>
                          <div className="w-4 h-4">
                            {platformIcons[ch.platform as keyof typeof platformIcons]}
                          </div>
                        </div>
                        <span className="font-medium">{platformLabels[ch.platform as keyof typeof platformLabels] || ch.platform}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ch.channel_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{ch.channel_posts?.length || 0}</TableCell>
                    <TableCell className="text-right">
                      {alloc ? `$${alloc.amount || '0'} (${alloc.percent || '0'}%)` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {channels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">No channels added yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add-ons / Vectors Table */}
      {addons.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Campaign Vectors / Add-Ons</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vector</TableHead>
                  <TableHead className="text-right">Budget Allocation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addons.map((a) => {
                  const def = allAddonDefs.find(d => d.key === a.addon_type);
                  const alloc = allocations[a.addon_type];
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <span className="mr-2">{def?.icon || '📦'}</span>
                        {def?.label || a.addon_type}
                      </TableCell>
                      <TableCell className="text-right">
                        {alloc ? `$${alloc.amount || '0'} (${alloc.percent || '0'}%)` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Budget Status */}
      {budget && (
        <div className="flex items-center gap-2">
          <Badge className={budget.accepted ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}>
            {budget.accepted ? '✓ Budget Accepted' : '⏳ Budget Pending Acceptance'}
          </Badge>
        </div>
      )}
    </div>
  );
};

export default CampaignDashboardSection;
