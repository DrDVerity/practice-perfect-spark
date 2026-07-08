/**
 * GenerationProgress — full-panel overlay shown while the Campaign Agent runs.
 * Driven by campaigns.generation_status.
 */
import React from 'react';
import { CheckCircle2, Loader2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const PHASES: { key: string; label: string; statuses: string[] }[] = [
  { key: 'planning', label: 'Reading knowledge base & building strategic plan', statuses: ['planning', 'plan_ready'] },
  { key: 'writing_content', label: 'Writing blog article and generating hero image', statuses: ['writing_content', 'content_ready'] },
  { key: 'deriving_posts', label: 'Deriving social posts, email & SMS variants', statuses: ['deriving_posts', 'processing'] },
  { key: 'completed', label: 'Ready for review', statuses: ['completed'] },
];

const ORDER = ['planning', 'plan_ready', 'writing_content', 'content_ready', 'deriving_posts', 'processing', 'completed'];

interface Props {
  status: string | null;
  error?: string | null;
  onRetry?: () => void;
}

export default function GenerationProgress({ status, error, onRetry }: Props) {
  const rank = (s: string | null | undefined) => (s ? ORDER.indexOf(s) : -1);
  const currentRank = rank(status);

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 md:p-8 mb-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Campaign Agent at work</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This usually takes 1–3 minutes. You can leave this page — progress persists.
          </p>
        </div>
        {status === 'failed' && onRetry && (
          <button
            onClick={onRetry}
            className="text-sm font-medium text-primary hover:underline"
          >
            Retry
          </button>
        )}
      </div>

      <ol className="space-y-3">
        {PHASES.map((phase) => {
          const phaseRank = ORDER.indexOf(phase.statuses[phase.statuses.length - 1]);
          const active = phase.statuses.includes(status || '');
          const done = currentRank > phaseRank || status === 'completed';
          return (
            <li key={phase.key} className="flex items-center gap-3">
              {done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : active ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
              )}
              <span className={cn(
                'text-sm',
                done && 'text-foreground',
                active && 'text-foreground font-medium',
                !done && !active && 'text-muted-foreground',
              )}>
                {phase.label}
              </span>
            </li>
          );
        })}
      </ol>

      {status === 'failed' && (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Generation failed{error ? `: ${error}` : ''}.
        </div>
      )}
    </div>
  );
}
