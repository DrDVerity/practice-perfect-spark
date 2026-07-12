import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';
import { GoogleIcon } from '@/components/icons/GoogleIcon';

export type PlanTier = 'trial' | 'single' | 'group';

export interface PlanOption {
  id: PlanTier;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  highlight?: boolean;
}

export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'trial',
    name: '14-Day Free Trial',
    price: '$0',
    cadence: 'no card required',
    blurb: 'Explore the full platform for 14 days.',
    features: ['Full access', 'Save & edit generated assets', 'Connect social channels', 'Upgrade any time'],
  },
  {
    id: 'single',
    name: 'Single Location',
    price: '$399',
    cadence: '/ month',
    blurb: 'Everything you need for one practice.',
    features: ['All content generation', 'Unlimited campaigns', 'Multi-channel publishing', 'Lead capture pages', 'Priority support'],
    highlight: true,
  },
  {
    id: 'group',
    name: 'Group / Multi-Location',
    price: '$699',
    cadence: '/ month',
    blurb: 'For dentist-owned groups.',
    features: ['Everything in Single', 'Multiple locations', 'Team roles & approvals', 'Centralized brand controls', 'Dedicated success manager'],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (plan: PlanTier) => void;
}

export const PlanPickerDialog: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const [selected, setSelected] = useState<PlanTier>('trial');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Choose your plan</DialogTitle>
          <DialogDescription>
            Start with a 14-day free trial or pick a paid plan. You can change your plan any time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3 mt-4">
          {PLAN_OPTIONS.map((p) => {
            const isSelected = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`relative text-left flex flex-col rounded-2xl border-2 p-5 transition-all ${
                  isSelected
                    ? 'border-primary bg-accent/40 shadow-lg'
                    : 'border-border bg-card hover:border-primary/40'
                } ${p.highlight ? 'md:-translate-y-1' : ''}`}
              >
                {p.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Most Popular
                  </span>
                )}
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{p.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">{p.price}</span>
                  <span className="text-xs text-muted-foreground">{p.cadence}</span>
                </div>
                <p className="mt-2 text-sm text-foreground/80">{p.blurb}</p>
                <ul className="mt-4 space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isSelected && (
                  <div className="mt-3 text-xs font-semibold text-primary flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button variant="google" size="lg" className="w-full" onClick={() => onSelect(selected)}>
            <GoogleIcon className="w-5 h-5" />
            Continue with Google
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {selected === 'trial'
              ? 'No card required. You will be enrolled in a 14-day nurture email series.'
              : 'You will be billed after your account is set up. Cancel any time.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
