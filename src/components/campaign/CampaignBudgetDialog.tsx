import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CAMPAIGN_ADDONS, AddonInfo } from './CampaignAddonDialog';
import { CampaignAddon } from '@/hooks/useCampaignAddons';
import { toast } from 'sonner';
import { DollarSign, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ChannelLite {
  id?: string;
  platform: string;
  channel_type: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addons: CampaignAddon[];
  customAddons: AddonInfo[];
  channels?: ChannelLite[];
  initialBudget?: { total: number; allocations: Record<string, { percent: number; amount: number }> };
  onAccept: (budget: { total: number; allocations: Record<string, { percent: number; amount: number }> }) => void;
}

const PLATFORM_LABELS: Record<string, { label: string; icon: string }> = {
  facebook: { label: 'Facebook', icon: '📘' },
  instagram: { label: 'Instagram', icon: '📸' },
  linkedin: { label: 'LinkedIn', icon: '💼' },
  twitter: { label: 'X / Twitter', icon: '🐦' },
  tiktok: { label: 'TikTok', icon: '🎵' },
  youtube: { label: 'YouTube', icon: '▶️' },
  mailchimp: { label: 'Mailchimp', icon: '📧' },
  beehive: { label: 'Beehiiv', icon: '🐝' },
  internal_email: { label: 'Internal Email', icon: '✉️' },
  internal_sms: { label: 'SMS', icon: '💬' },
};

const channelKey = (platform: string) => `channel:${platform}`;
const addonKey = (k: string) => `addon:${k}`;

const CampaignBudgetDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  addons,
  customAddons,
  channels = [],
  initialBudget,
  onAccept,
}) => {
  const [totalBudget, setTotalBudget] = useState('');
  const [allocations, setAllocations] = useState<Record<string, { percent: string; amount: string }>>({});

  const allAddonDefs = useMemo(() => [...CAMPAIGN_ADDONS, ...customAddons], [customAddons]);

  // Initialize from saved budget or empty
  useEffect(() => {
    if (!open) return;
    setTotalBudget(initialBudget ? initialBudget.total.toString() : '');
    const init: Record<string, { percent: string; amount: string }> = {};
    const saved = initialBudget?.allocations || {};
    channels.forEach((c) => {
      const k = channelKey(c.platform);
      // Read either the namespaced key or, for legacy budgets, an exact platform key
      const v = saved[k] ?? saved[c.platform];
      init[k] = v
        ? { percent: v.percent.toString(), amount: v.amount.toString() }
        : { percent: '', amount: '' };
    });
    addons.forEach((a) => {
      const k = addonKey(a.addon_type);
      const v = saved[k] ?? saved[a.addon_type];
      init[k] = v
        ? { percent: v.percent.toString(), amount: v.amount.toString() }
        : { percent: '', amount: '' };
    });
    setAllocations(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channels.length, addons.length]);

  const total = parseFloat(totalBudget) || 0;

  // When total budget changes, recompute each row's $ amount from its existing %
  useEffect(() => {
    setAllocations((prev) => {
      const next: Record<string, { percent: string; amount: string }> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const pct = parseFloat(v.percent) || 0;
        const amt = total > 0 && v.percent !== '' ? ((pct / 100) * total).toFixed(2) : v.amount;
        next[k] = { percent: v.percent, amount: amt };
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const handlePercentChange = (key: string, val: string) => {
    const pct = parseFloat(val) || 0;
    const amt = total > 0 ? ((pct / 100) * total).toFixed(2) : '';
    setAllocations((prev) => ({ ...prev, [key]: { percent: val, amount: amt.toString() } }));
  };

  const handleAmountChange = (key: string, val: string) => {
    const amt = parseFloat(val) || 0;
    const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : '';
    setAllocations((prev) => ({ ...prev, [key]: { percent: pct.toString(), amount: val } }));
  };

  const allocatedTotal = Object.values(allocations).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const remaining = total - allocatedTotal;
  const allocatedPct = Object.values(allocations).reduce((s, a) => s + (parseFloat(a.percent) || 0), 0);

  const handleAccept = () => {
    if (total <= 0) {
      toast.error('Please enter a total budget amount');
      return;
    }
    if (allocatedPct > 100.5) {
      toast.error('Budget allocation exceeds 100%');
      return;
    }
    const result: Record<string, { percent: number; amount: number }> = {};
    Object.entries(allocations).forEach(([key, val]) => {
      result[key] = { percent: parseFloat(val.percent) || 0, amount: parseFloat(val.amount) || 0 };
    });
    onAccept({ total, allocations: result });
    toast.success('Budget allocation accepted');
    onOpenChange(false);
  };

  const renderAllocationRow = (
    key: string,
    label: string,
    icon: string,
    runningRef: { current: number },
  ) => {
    const alloc = allocations[key] || { percent: '', amount: '' };
    const pctNum = parseFloat(alloc.percent) || 0;
    const amtNum = parseFloat(alloc.amount) || 0;
    const negative = pctNum < 0 || amtNum < 0;
    const prevRunning = runningRef.current;
    runningRef.current += pctNum;
    const pushedOver = (prevRunning <= 100 && runningRef.current > 100) || prevRunning > 100;
    const rowError = negative || pushedOver;
    const inputErr = rowError ? 'border-destructive text-destructive focus-visible:ring-destructive' : '';
    return (
      <TableRow key={key} className={rowError ? 'bg-destructive/5' : ''}>
        <TableCell className={`font-medium text-xs sm:text-sm py-2 px-2 sm:px-4 ${rowError ? 'text-destructive' : ''}`}>
          <span className="mr-1 sm:mr-2">{icon}</span>
          <span className="break-words">{label}</span>
        </TableCell>
        <TableCell className="text-right py-2 px-1 sm:px-4">
          <Input
            type="number"
            step="0.5"
            placeholder="0"
            value={alloc.percent}
            onChange={(e) => handlePercentChange(key, e.target.value)}
            className={`w-14 sm:w-20 ml-auto text-right h-8 text-xs sm:text-sm px-1 sm:px-2 ${inputErr}`}
          />
        </TableCell>
        <TableCell className="text-right py-2 px-1 sm:px-4">
          <div className="relative">
            <span className={`absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 text-xs ${rowError ? 'text-destructive' : 'text-muted-foreground'}`}>$</span>
            <Input
              type="number"
              step="50"
              placeholder="0"
              value={alloc.amount}
              onChange={(e) => handleAmountChange(key, e.target.value)}
              className={`w-20 sm:w-28 ml-auto text-right h-8 text-xs sm:text-sm pl-4 sm:pl-5 px-1 sm:px-2 ${inputErr}`}
            />
          </div>
        </TableCell>
      </TableRow>

    );
  };

  const runningRef = { current: 0 };
  const hasAnyRows = channels.length > 0 || addons.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Campaign Budget
          </DialogTitle>
          <DialogDescription>
            Set your total campaign budget and allocate funds across every channel and add-on in this campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-6 py-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm px-2 sm:px-4">Item</TableHead>
                <TableHead className="w-16 sm:w-28 text-right text-xs sm:text-sm px-1 sm:px-4">%</TableHead>
                <TableHead className="w-24 sm:w-36 text-right text-xs sm:text-sm px-1 sm:px-4">$</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell className="text-xs sm:text-sm px-2 sm:px-4">Total Budget</TableCell>
                <TableCell className="text-right text-muted-foreground text-xs sm:text-sm px-1 sm:px-4">100%</TableCell>
                <TableCell className="text-right px-1 sm:px-4">
                  <div className="relative">
                    <span className={`absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 text-xs ${total < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>$</span>
                    <Input
                      type="number"
                      step="100"
                      placeholder="10000"
                      value={totalBudget}
                      onChange={(e) => setTotalBudget(e.target.value)}
                      className={`w-20 sm:w-28 ml-auto text-right h-8 text-xs sm:text-sm pl-4 sm:pl-5 px-1 sm:px-2 ${total < 0 ? 'border-destructive text-destructive' : ''}`}
                    />
                  </div>
                </TableCell>
              </TableRow>


              {!hasAnyRows && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-4">
                    No channels or add-ons yet. Add channels or include campaign add-ons first to allocate budget.
                  </TableCell>
                </TableRow>
              )}

              {channels.length > 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/20 py-2">
                    Channels
                  </TableCell>
                </TableRow>
              )}
              {channels.map((c) => {
                const meta = PLATFORM_LABELS[c.platform] || { label: c.platform, icon: '📡' };
                return renderAllocationRow(channelKey(c.platform), meta.label, meta.icon, runningRef);
              })}

              {addons.length > 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/20 py-2">
                    Add-Ons / Vectors
                  </TableCell>
                </TableRow>
              )}
              {addons.map((a) => {
                const info = allAddonDefs.find((ad) => ad.key === a.addon_type);
                return renderAllocationRow(
                  addonKey(a.addon_type),
                  info?.label || a.addon_type,
                  info?.icon || '📦',
                  runningRef,
                );
              })}

              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total Allocated</TableCell>
                <TableCell className={`text-right ${allocatedPct > 100 || allocatedPct < 0 ? 'text-destructive' : ''}`}>
                  {allocatedPct < 0 ? '-' : ''}{allocatedPct.toFixed(1)}%
                </TableCell>
                <TableCell className={`text-right ${allocatedTotal > total || allocatedTotal < 0 ? 'text-destructive' : ''}`}>
                  {allocatedTotal < 0 ? '-' : ''}${Math.abs(allocatedTotal).toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow className="font-semibold">
                <TableCell>Remaining</TableCell>
                <TableCell className={`text-right ${100 - allocatedPct < 0 ? 'text-destructive' : ''}`}>
                  {100 - allocatedPct < 0 ? '-' : ''}{Math.abs(100 - allocatedPct).toFixed(1)}%
                </TableCell>
                <TableCell className={`text-right ${remaining < 0 ? 'text-destructive' : ''}`}>
                  {remaining < 0 ? '-' : ''}${Math.abs(remaining).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="p-4 sm:p-6 pt-3 border-t shrink-0 bg-background">
          <Button onClick={handleAccept} className="w-full" disabled={total <= 0}>
            Accept Budget Allocation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignBudgetDialog;
