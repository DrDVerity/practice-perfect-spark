import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Bot, History, Pencil, Sparkles, DollarSign, Calendar as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type CreateCampaignMode = 'agent' | 'self' | 'reuse';
export type DurationUnit = 'days' | 'weeks' | 'months';

export interface CreateCampaignSubmit {
  name: string;
  focus: string;
  mode: CreateCampaignMode;
  reuseFromCampaignId?: string;
  budgetAmount: number;
  durationValue: number;
  durationUnit: DurationUnit;
}

interface CreateCampaignDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCampaignSubmit) => void;
  isLoading?: boolean;
  /** When admin/manager is viewing a client, look up that client's past campaigns instead of self. */
  targetUserId?: string;
}

type Step = 'form' | 'pickPast';

export const CreateCampaignDialog: React.FC<CreateCampaignDialogProps> = ({
  open,
  onClose,
  onSubmit,
  isLoading,
  targetUserId,
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [budget, setBudget] = useState<string>('');
  const [durationValue, setDurationValue] = useState<string>('30');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [step, setStep] = useState<Step>('form');
  const [pastCampaigns, setPastCampaigns] = useState<any[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setFocus('');
      setBudget('');
      setDurationValue('30');
      setDurationUnit('days');
      setStep('form');
      setPastCampaigns([]);
    }
  }, [open]);

  const budgetNum = Number(budget);
  const durationNum = Number(durationValue);
  const isValid =
    !!name.trim() &&
    Number.isFinite(budgetNum) && budgetNum > 0 &&
    Number.isFinite(durationNum) && durationNum > 0 && Number.isInteger(durationNum);

  const baseSubmit = () => ({
    name: name.trim(),
    focus: focus.trim(),
    budgetAmount: budgetNum,
    durationValue: durationNum,
    durationUnit,
  });

  const loadPastCampaigns = async () => {
    const uid = targetUserId || user?.id;
    if (!uid) return;
    setLoadingPast(true);
    const { data } = await supabase
      .from('campaigns')
      .select('id, name, updated_at, created_at, status')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false });
    setPastCampaigns(data || []);
    setLoadingPast(false);
  };

  const handlePickReuse = async () => {
    if (!isValid) return;
    setStep('pickPast');
    await loadPastCampaigns();
  };

  const handleStartAgent = () => {
    if (!isValid) return;
    onSubmit({ ...baseSubmit(), mode: 'agent' });
  };

  const handleStartSelf = () => {
    if (!isValid) return;
    onSubmit({ ...baseSubmit(), mode: 'self' });
  };

  const handleSelectPast = (campaignId: string) => {
    onSubmit({ ...baseSubmit(), mode: 'reuse', reuseFromCampaignId: campaignId });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={step === 'pickPast' ? 'max-w-3xl' : 'sm:max-w-lg'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'pickPast' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -ml-2"
                onClick={() => setStep('form')}
                disabled={isLoading}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {step === 'pickPast' ? 'Reuse a Past Campaign' : 'Create New Campaign'}
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Spring Whitening Promo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="focus">Topic / Focus</Label>
              <Input
                id="focus"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="e.g., Teeth whitening, Invisalign, new patient drive"
              />
              <p className="text-xs text-muted-foreground">
                Optional. If left blank, the Campaign Agent will suggest topics based on your practice.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Total Budget (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="budget"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="2500"
                    className="pl-9"
                    required
                  />
                </div>
                {budget && (!Number.isFinite(budgetNum) || budgetNum <= 0) && (
                  <p className="text-xs text-destructive">Enter a budget greater than 0.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <div className="flex gap-2">
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={durationValue}
                    onChange={(e) => setDurationValue(e.target.value)}
                    className="flex-1"
                    required
                  />
                  <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as DurationUnit)}>
                    <SelectTrigger className="w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {durationValue && (!Number.isFinite(durationNum) || durationNum <= 0 || !Number.isInteger(durationNum)) && (
                  <p className="text-xs text-destructive">Enter a whole number greater than 0.</p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start h-auto py-3"
                disabled={!isValid || isLoading}
                onClick={handlePickReuse}
              >
                <History className="w-4 h-4 mr-2 shrink-0" />
                <div className="text-left">
                  <div className="font-semibold">Reuse a Past Campaign</div>
                  <div className="text-xs text-muted-foreground">Clone channels and strategy from a previous campaign.</div>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="justify-start h-auto py-3 border-primary/50"
                disabled={!isValid || isLoading}
                onClick={handleStartAgent}
              >
                <Bot className="w-4 h-4 mr-2 shrink-0 text-primary" />
                <div className="text-left">
                  <div className="font-semibold">Campaign Agent (AI design)</div>
                  <div className="text-xs text-muted-foreground">Let the AI research the topic and draft a blog article + plan.</div>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="justify-start h-auto py-3"
                disabled={!isValid || isLoading}
                onClick={handleStartSelf}
              >
                <Pencil className="w-4 h-4 mr-2 shrink-0" />
                <div className="text-left">
                  <div className="font-semibold">I'll Design It Myself</div>
                  <div className="text-xs text-muted-foreground">Open a blank campaign and add channels manually.</div>
                </div>
              </Button>
            </div>


            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'pickPast' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select a past campaign to clone its channels and strategy into <strong>{name}</strong>.
            </p>
            <div className="max-h-[420px] overflow-auto border rounded-md">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPast && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          Loading…
                        </TableCell>
                      </TableRow>
                    )}
                    {!loadingPast && pastCampaigns.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          No past campaigns yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {!loadingPast && pastCampaigns.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/60"
                        onClick={() => !isLoading && handleSelectPast(c.id)}
                      >
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.updated_at ? format(new Date(c.updated_at), 'MMM d, yyyy') : '—'}</TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground">—</span>
                            </TooltipTrigger>
                            <TooltipContent>Coming soon</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground">—</span>
                            </TooltipTrigger>
                            <TooltipContent>Coming soon</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
