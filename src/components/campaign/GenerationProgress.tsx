/**
 * GenerationProgress, full-panel overlay shown while the Campaign Agent runs.
 * Driven by campaigns.generation_status.
 */
import React from 'react';
import { CheckCircle2, Loader2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const PHASES: { key: string; label: string; statuses: string[] }[] = [
  { key: 'ensuring_kb', label: 'Checking knowledge base & generating missing reports', statuses: ['ensuring_kb'] },
  { key: 'planning', label: 'Building strategic plan from KB', statuses: ['planning', 'plan_ready'] },
  { key: 'writing_content', label: 'Writing blog article and generating hero image', statuses: ['writing_content', 'content_ready'] },
  { key: 'generating_video', label: 'Generating short-form video for YouTube / TikTok (< 15s) and long-form YouTube script', statuses: ['generating_video'] },
  { key: 'deriving_posts', label: 'Deriving 3 social posts per channel', statuses: ['deriving_posts', 'processing', 'posts_ready'] },
  { key: 'writing_funnel', label: 'Writing 6-email lead-nurture funnel', statuses: ['writing_funnel'] },
  { key: 'writing_drips', label: 'Drafting email & SMS drip messages', statuses: ['writing_drips'] },
  { key: 'building_landing_page', label: 'Building landing page', statuses: ['building_landing_page'] },
  { key: 'completed', label: 'Ready for review', statuses: ['completed'] },
];

const ORDER = ['ensuring_kb', 'planning', 'plan_ready', 'writing_content', 'content_ready', 'generating_video', 'deriving_posts', 'processing', 'posts_ready', 'writing_funnel', 'writing_drips', 'building_landing_page', 'completed'];

interface Props {
  status: string | null;
  error?: string | null;
  onRetry?: () => void;
}

export default function GenerationProgress({ status, error, onRetry }: Props) {
  // Treat a null/unknown status as "just started" so the first phase spins.
  const effectiveStatus = status || 'ensuring_kb';
  const rank = (s: string | null | undefined) => (s ? ORDER.indexOf(s) : -1);
  const currentRank = rank(effectiveStatus);

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 md:p-8 mb-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Campaign Agent at work</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This usually takes 1–3 minutes. You can leave this page, progress persists.
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
          const active = phase.statuses.includes(effectiveStatus);
          const done = currentRank > phaseRank || effectiveStatus === 'completed';
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
