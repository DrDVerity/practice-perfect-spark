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
import { ArrowLeft, Bot, History, Pencil, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type CreateCampaignMode = 'agent' | 'self' | 'reuse';

export interface CreateCampaignSubmit {
  name: string;
  focus: string;
  mode: CreateCampaignMode;
  reuseFromCampaignId?: string;
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
  const [step, setStep] = useState<Step>('form');
  const [pastCampaigns, setPastCampaigns] = useState<any[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setFocus('');
      setStep('form');
      setPastCampaigns([]);
    }
  }, [open]);

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
    if (!name.trim()) return;
    setStep('pickPast');
    await loadPastCampaigns();
  };

  const handleStartAgent = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), focus: focus.trim(), mode: 'agent' });
  };

  const handleStartSelf = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), focus: focus.trim(), mode: 'self' });
  };

  const handleSelectPast = (campaignId: string) => {
    onSubmit({
      name: name.trim(),
      focus: focus.trim(),
      mode: 'reuse',
      reuseFromCampaignId: campaignId,
    });
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

            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start h-auto py-3"
                disabled={!name.trim() || isLoading}
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
                disabled={!name.trim() || isLoading}
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
                disabled={!name.trim() || isLoading}
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
