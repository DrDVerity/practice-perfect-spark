import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (budgetTotal: number, mode: 'paid' | 'organic') => void;
}

const BudgetPromptDialog: React.FC<Props> = ({ open, onOpenChange, onConfirm }) => {
  const [amount, setAmount] = useState<string>('');

  const handlePaid = () => {
    const n = Number(amount.replace(/[^0-9.]/g, ''));
    if (!n || n <= 0) return;
    onConfirm(n, 'paid');
    onOpenChange(false);
    setAmount('');
  };

  const handleOrganic = () => {
    onConfirm(0, 'organic');
    onOpenChange(false);
    setAmount('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Campaign Budget
          </DialogTitle>
          <DialogDescription>
            Enter a budget if you want paid advertising in your strategy. Leave blank for an organic
            social-only plan with no spend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-9"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && amount) handlePaid(); }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handlePaid} disabled={!Number(amount.replace(/[^0-9.]/g, ''))}>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Strategy with ${amount || '0'} Budget
            </Button>
            <Button variant="outline" onClick={handleOrganic}>
              No Budget, Organic Social Only
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BudgetPromptDialog;
