/**
 * AcceptSectionButton — small pill used on section headers so users can mark
 * a section (and its cascaded children) as Accepted. Toggles on click and
 * stops propagation so it doesn't trigger the surrounding row expander.
 */
import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
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

// Rendered as a <span role="button"> so it can safely live inside another
// <button> (e.g. Radix AccordionTrigger) without violating DOM nesting.
export default function AcceptSectionButton({
  accepted,
  onToggle,
  loading,
  labelWhenAccepted = 'Accepted',
  labelWhenPending = 'Accept',
  size = 'sm',
  className,
}: Props) {
  const handleActivate = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (loading) return;
    onToggle(!accepted);
  };
  const sizeCls = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm';
  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={accepted}
      aria-disabled={loading || undefined}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleActivate(e);
      }}
      title={accepted ? 'Click to un-accept' : 'Accept this section'}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-md font-semibold border transition-colors select-none',
        sizeCls,
        accepted
          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
          : 'bg-background hover:bg-accent hover:text-accent-foreground border-input text-foreground',
        loading && 'opacity-60 cursor-not-allowed',
        className,
      )}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <CheckCircle2 className="w-3.5 h-3.5" />}
      <span className="text-xs">{accepted ? labelWhenAccepted : labelWhenPending}</span>
    </span>
  );
}
