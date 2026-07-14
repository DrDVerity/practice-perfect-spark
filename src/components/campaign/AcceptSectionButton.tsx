/**
 * AcceptSectionButton — small pill used on section headers so users can mark
 * a section (and its cascaded children) as Accepted. Toggles on click and
 * stops propagation so it doesn't trigger the surrounding row expander.
 */
import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  accepted: boolean;
  onToggle: (v: boolean) => void | Promise<void>;
  loading?: boolean;
  labelWhenAccepted?: string;
  labelWhenPending?: string;
  size?: 'sm' | 'default';
  className?: string;
}

export default function AcceptSectionButton({
  accepted,
  onToggle,
  loading,
  labelWhenAccepted = 'Accepted',
  labelWhenPending = 'Accept',
  size = 'sm',
  className,
}: Props) {
  return (
    <Button
      size={size}
      variant={accepted ? 'default' : 'outline'}
      className={cn(
        'gap-1 font-semibold',
        accepted && 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle(!accepted);
      }}
      disabled={loading}
      title={accepted ? 'Click to un-accept' : 'Accept this section'}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <CheckCircle2 className="w-3.5 h-3.5" />}
      <span className="text-xs">{accepted ? labelWhenAccepted : labelWhenPending}</span>
    </Button>
  );
}
