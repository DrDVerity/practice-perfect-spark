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
import { Label } from '@/components/ui/label';
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
import { DollarSign } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addons: CampaignAddon[];
  customAddons: AddonInfo[];
  initialBudget?: { total: number; allocations: Record<string, { percent: number; amount: number }> };
  onAccept: (budget: { total: number; allocations: Record<string, { percent: number; amount: number }> }) => void;
}

const CampaignBudgetDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  addons,
  customAddons,
  initialBudget,
  onAccept,
}) => {
  const [totalBudget, setTotalBudget] = useState('');
  const [allocations, setAllocations] = useState<Record<string, { percent: string; amount: string }>>({});

  const allAddonDefs = useMemo(() => [...CAMPAIGN_ADDONS, ...customAddons], [customAddons]);

  // Initialize from saved budget or empty
  useEffect(() => {
    if (open && initialBudget) {
      setTotalBudget(initialBudget.total.toString());
      const init: Record<string, { percent: string; amount: string }> = {};
      addons.forEach((a) => {
        const saved = initialBudget.allocations[a.addon_type];
        init[a.addon_type] = saved
          ? { percent: saved.percent.toString(), amount: saved.amount.toString() }
          : { percent: '', amount: '' };
      });
      setAllocations(init);
    } else if (open) {
      const init: Record<string, { percent: string; amount: string }> = {};
      addons.forEach((a) => {
        init[a.addon_type] = { percent: '', amount: '' };
      });
      setAllocations(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, addons.length]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Campaign Budget
          </DialogTitle>
          <DialogDescription>
            Set your total campaign budget and allocate funds across included add-ons.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Total Budget */}
          <div className="space-y-2">
            <Label htmlFor="total-budget" className="text-sm font-semibold">Total Campaign Budget</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="total-budget"
                type="number"
                min="0"
                step="100"
                placeholder="10000"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Allocation Table */}
          {addons.length > 0 && (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Add-On</TableHead>
                    <TableHead className="w-28 text-right">% Budget</TableHead>
                    <TableHead className="w-36 text-right">$ Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    let running = 0;
                    return addons.map((a) => {
                      const info = allAddonDefs.find((ad) => ad.key === a.addon_type);
                      const alloc = allocations[a.addon_type] || { percent: '', amount: '' };
                      const pctNum = parseFloat(alloc.percent) || 0;
                      const amtNum = parseFloat(alloc.amount) || 0;
                      const negative = pctNum < 0 || amtNum < 0;
                      const prevRunning = running;
                      running += pctNum;
                      const pushedOver = (prevRunning <= 100 && running > 100) || prevRunning > 100;
                      const rowError = negative || pushedOver;
                      const inputErr = rowError ? 'border-destructive text-destructive focus-visible:ring-destructive' : '';
                      return (
                        <TableRow key={a.id} className={rowError ? 'bg-destructive/5' : ''}>
                          <TableCell className={`font-medium ${rowError ? 'text-destructive' : ''}`}>
                            <span className="mr-2">{info?.icon || '📦'}</span>
                            {info?.label || a.addon_type}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.5"
                              placeholder="0"
                              value={alloc.percent}
                              onChange={(e) => handlePercentChange(a.addon_type, e.target.value)}
                              className={`w-20 ml-auto text-right h-8 text-sm ${inputErr}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="relative">
                              <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs ${rowError ? 'text-destructive' : 'text-muted-foreground'}`}>$</span>
                              <Input
                                type="number"
                                step="50"
                                placeholder="0"
                                value={alloc.amount}
                                onChange={(e) => handleAmountChange(a.addon_type, e.target.value)}
                                className={`w-28 ml-auto text-right h-8 text-sm pl-5 ${inputErr}`}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                  {/* Summary row */}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell>Total Allocated</TableCell>
                    <TableCell className={`text-right ${allocatedPct > 100 ? 'text-destructive' : ''}`}>{allocatedPct.toFixed(1)}%</TableCell>
                    <TableCell className={`text-right ${allocatedTotal > total ? 'text-destructive' : ''}`}>${allocatedTotal.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold">
                    <TableCell>Remaining</TableCell>
                    <TableCell className={`text-right ${100 - allocatedPct < 0 ? 'text-destructive' : ''}`}>{(100 - allocatedPct).toFixed(1)}%</TableCell>
                    <TableCell className={`text-right ${remaining < 0 ? 'text-destructive' : ''}`}>
                      ${remaining.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {addons.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No add-ons included yet. Include campaign add-ons first to allocate budget.
            </p>
          )}

          <Button onClick={handleAccept} className="w-full" disabled={addons.length === 0 || total <= 0}>
            Accept Budget Allocation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignBudgetDialog;
