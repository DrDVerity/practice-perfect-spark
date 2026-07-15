/**
 * GenerationProgress — blocking overlay shown while the Campaign Agent runs.
 * Driven by campaigns.generation_status. The overlay can be minimized to a
 * floating pill (green while working, red flashing when done/failed) that
 * expands again on click.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Circle, Minus, Maximize2, X, AlertTriangle } from 'lucide-react';
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

const DONE_STATUSES = new Set(['completed', 'failed']);

interface Props {
  status: string | null;
  error?: string | null;
  onRetry?: () => void;
  /** Optional campaign id — used to key the minimized/expanded state per campaign. */
  campaignId?: string;
}

export default function GenerationProgress({ status, error, onRetry, campaignId }: Props) {
  const storageKey = `campaign-agent-minimized:${campaignId || 'default'}`;
  const dismissedKey = `campaign-agent-dismissed:${campaignId || 'default'}`;
  const [minimized, setMinimized] = useState<boolean>(() => {
    try { return sessionStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(dismissedKey) === '1'; } catch { return false; }
  });
  // Auto-expand once when the run finishes so the user sees the final state.
  const [autoExpanded, setAutoExpanded] = useState(false);
  useEffect(() => {
    if (DONE_STATUSES.has(status || '') && !autoExpanded) {
      setMinimized(false);
      setAutoExpanded(true);
    }
  }, [status, autoExpanded]);

  // If a new run starts after the overlay was dismissed, show it again.
  useEffect(() => {
    if (!DONE_STATUSES.has(status || '') && dismissed) {
      setDismissed(false);
      try { sessionStorage.removeItem(dismissedKey); } catch { /* ignore */ }
    }
  }, [status, dismissed, dismissedKey]);

  const setMinimizedPersist = (v: boolean) => {
    setMinimized(v);
    try { sessionStorage.setItem(storageKey, v ? '1' : '0'); } catch { /* ignore */ }
  };

  const dismiss = () => {
    setDismissed(true);
    setMinimizedPersist(false);
    try { sessionStorage.setItem(dismissedKey, '1'); } catch { /* ignore */ }
  };

  const effectiveStatus = status || 'ensuring_kb';
  const rank = (s: string | null | undefined) => (s ? ORDER.indexOf(s) : -1);
  const currentRank = rank(effectiveStatus);
  const isDone = status === 'completed';
  const isFailed = status === 'failed';
  const isWorking = !isDone && !isFailed;

  // Once finished and explicitly dismissed, hide the overlay and the pill entirely.
  if (dismissed && DONE_STATUSES.has(status || '')) return null;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimizedPersist(false)}
        className={cn(
          'fixed bottom-6 right-6 z-[100] rounded-full shadow-lg border px-4 py-2.5',
          'flex items-center gap-2 text-sm font-medium transition-all hover:scale-105',
          isWorking && 'bg-emerald-600 text-white border-emerald-700',
          isDone && 'bg-red-600 text-white border-red-700 animate-pulse',
          isFailed && 'bg-red-600 text-white border-red-700 animate-pulse',
        )}
        title={isWorking ? 'Agent working — click to expand' : 'Agent finished — click to review'}
      >
        <span className={cn(
          'w-2.5 h-2.5 rounded-full',
          isWorking ? 'bg-white animate-pulse' : 'bg-white',
        )} />
        <span>
          {isWorking && 'Agent working…'}
          {isDone && 'Ready — click to review'}
          {isFailed && 'Agent failed — click for details'}
        </span>
        <Maximize2 className="w-4 h-4 opacity-80" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-primary/40 bg-card shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              {isWorking && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
              {isDone && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {isFailed && <AlertTriangle className="w-5 h-5 text-destructive" />}
              Campaign Agent at work
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isWorking && 'This usually takes 1–3 minutes. Editing is paused while the agent works — you can browse the page or minimize this window.'}
              {isDone && 'All assets are ready. You can review and accept them below.'}
              {isFailed && 'Something went wrong during generation.'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isFailed && onRetry && (
              <button
                onClick={onRetry}
                className="text-sm font-medium text-primary hover:underline px-2"
              >
                Retry
              </button>
            )}
            {isWorking ? (
              <button
                type="button"
                onClick={() => setMinimizedPersist(true)}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Minimize"
                aria-label="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={dismiss}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
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

        {isFailed && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            Generation failed{error ? `: ${error}` : ''}.
          </div>
        )}
      </div>
    </div>
  );
}
