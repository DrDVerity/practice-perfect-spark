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
import { DollarSign, KeyRound, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ChannelCredentialLite {
  id: string;
  platform_name: string;
}

interface CampaignDashboardSectionProps {
  channels: { id: string; platform: string; channel_type: string; channel_posts?: any[] }[];
  addons: { id: string; addon_type: string }[];
  budget?: { total_amount: number; allocations: any; accepted: boolean } | null;
  customAddons?: { key: string; label: string; icon: string }[];
  credentials?: ChannelCredentialLite[];
  onBudgetClick?: () => void;
  onChannelClick?: (channelId: string) => void;
  onAddonClick?: (addonType: string) => void;
  onAddCredential?: (platformName: string) => void;
}

// Platforms that don't require external credentials
const PLATFORMS_NO_CREDS = new Set(['internal_email', 'internal_sms']);

const credConfiguredFor = (platform: string, label: string, creds: ChannelCredentialLite[]) => {
  const target = (label || platform).toLowerCase().trim();
  return creds.some(c => {
    const name = (c.platform_name || '').toLowerCase().trim();
    return name === target || name === platform.toLowerCase();
  });
};

const CampaignDashboardSection: React.FC<CampaignDashboardSectionProps> = ({
  channels,
  addons,
  budget,
  customAddons = [],
  credentials = [],
  onBudgetClick,
  onChannelClick,
  onAddonClick,
  onAddCredential,
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
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Campaign Channels & Platforms</span>
            <Badge variant="outline" className="text-xs">{channels.length} configured</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Posts</TableHead>
                <TableHead>Credentials</TableHead>
                <TableHead className="text-right">Budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((ch) => {
                const key = ch.platform;
                const alloc = allocations[key];
                const label = platformLabels[ch.platform as keyof typeof platformLabels] || ch.platform;
                const needsCreds = !PLATFORMS_NO_CREDS.has(ch.platform);
                const hasCreds = credConfiguredFor(ch.platform, label, credentials);

                const handleClick = () => {
                  if (needsCreds && !hasCreds && onAddCredential) {
                    onAddCredential(label);
                  } else if (onChannelClick) {
                    onChannelClick(ch.id);
                  }
                };

                return (
                  <TableRow
                    key={ch.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={handleClick}
                    title={needsCreds && !hasCreds ? "Click to add credentials" : "Click to edit posts"}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${platformColors[ch.platform as keyof typeof platformColors] || 'bg-muted'}`}>
                          <div className="w-4 h-4">
                            {platformIcons[ch.platform as keyof typeof platformIcons]}
                          </div>
                        </div>
                        <span className="font-medium">{label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ch.channel_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{ch.channel_posts?.length || 0}</TableCell>
                    <TableCell>
                      {!needsCreds ? (
                        <Badge variant="outline" className="text-xs">N/A</Badge>
                      ) : hasCreds ? (
                        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Configured
                        </Badge>
                      ) : (
                        <Badge
                          className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 gap-1"
                          onClick={(e) => { e.stopPropagation(); onAddCredential?.(label); }}
                        >
                          <AlertTriangle className="w-3 h-3" /> Needs setup
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {alloc ? `$${alloc.amount || '0'} (${alloc.percent || '0'}%)` : ', '}
                    </TableCell>
                  </TableRow>
                );
              })}
              {channels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No channels added yet, use the “Add Channel” button above to add Social, Email, or SMS platforms.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add-ons / Vectors Table, always rendered */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Campaign Vectors / Add-Ons</span>
            <Badge variant="outline" className="text-xs">{addons.length} included</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vector</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Budget Allocation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addons.map((a) => {
                const def = allAddonDefs.find(d => d.key === a.addon_type);
                const alloc = allocations[a.addon_type];
                return (
                  <TableRow
                    key={a.id}
                    className={onAddonClick ? "cursor-pointer hover:bg-accent/40" : ""}
                    onClick={() => onAddonClick?.(a.addon_type)}
                    title={onAddonClick ? "Open vector to edit" : undefined}
                  >
                    <TableCell>
                      <span className="mr-2">{def?.icon || '📦'}</span>
                      {def?.label || a.addon_type}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Included
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {alloc ? `$${alloc.amount || '0'} (${alloc.percent || '0'}%)` : ', '}
                    </TableCell>
                  </TableRow>
                );
              })}
              {addons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    No vectors / add-ons selected, pick one from the Campaign Add-Ons section above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Credential summary hint */}
      {credentials.length === 0 && channels.some(c => !PLATFORMS_NO_CREDS.has(c.platform)) && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
          <KeyRound className="w-4 h-4" />
          No platform credentials saved yet. Click any “Needs setup” badge to add credentials.
        </div>
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
