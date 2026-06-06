import React, { useEffect, useRef } from 'react';
import { useOnboardingReports } from '@/hooks/useOnboardingReports';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FlaskConical, Loader2, CheckCircle2, AlertTriangle, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  /** Practice owner's user_id (self, or a client when an admin/manager is viewing). */
  targetUserId?: string | null;
  /** Whether this practice has at least one connected social account. */
  hasConnectedSocial: boolean;
  /** Whether the practice has a website URL on file. */
  hasWebsite: boolean;
}

/**
 * Shows the status of the automatic onboarding research suite and auto-starts
 * it once the practice has both a website URL and a connected social account.
 */
const ResearchReportsBanner: React.FC<Props> = ({ targetUserId, hasConnectedSocial, hasWebsite }) => {
  const navigate = useNavigate();
  const { state, isRunning, isComplete, trigger } = useOnboardingReports(targetUserId);
  const autoFiredRef = useRef(false);

  const status = state?.status ?? 'pending';
  const ready = hasWebsite && hasConnectedSocial;

  // Auto-start once when the website is set and generation hasn't begun. The
  // edge function is the source of truth: it re-checks for connected social
  // accounts and returns 'awaiting_social' (leaving status untouched) if none,
  // so a silent attempt is safe even when we can't confirm a connection client
  // side. A short-lived sessionStorage guard avoids re-firing on every nav.
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (!targetUserId || !hasWebsite) return;
    if (status !== 'pending' && status != null) return;

    const throttleKey = `orr-tried-${targetUserId}`;
    const last = Number(sessionStorage.getItem(throttleKey) || 0);
    if (Date.now() - last < 10 * 60 * 1000) return; // at most once / 10 min / session

    autoFiredRef.current = true;
    sessionStorage.setItem(throttleKey, String(Date.now()));
    trigger.mutate({ silent: true });
  }, [targetUserId, hasWebsite, status, trigger]);

  // Nothing to show until the practice is set up enough to research.
  if (!hasWebsite && status === 'pending') return null;

  const total = state?.total || 10;
  const done = state?.done || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  let icon = <FlaskConical className="w-5 h-5 text-primary" />;
  let title = 'Practice research';
  let body: React.ReactNode = null;

  if (status === 'running') {
    icon = <Loader2 className="w-5 h-5 text-primary animate-spin" />;
    title = 'Generating practice research reports…';
    body = (
      <div className="space-y-2 mt-2">
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground">{done} of {total} reports generated</p>
      </div>
    );
  } else if (status === 'complete') {
    icon = <CheckCircle2 className="w-5 h-5 text-green-600" />;
    title = 'Practice research complete';
    body = (
      <p className="text-sm text-muted-foreground mt-1">
        Your full report set is saved to the Knowledge Base.
      </p>
    );
  } else if (status === 'error') {
    icon = <AlertTriangle className="w-5 h-5 text-destructive" />;
    title = 'Research could not be completed';
    body = (
      <p className="text-sm text-muted-foreground mt-1">
        {state?.error || 'Something went wrong.'} You can retry below.
      </p>
    );
  } else {
    // pending / awaiting prerequisites
    title = 'Practice research is queued';
    body = (
      <p className="text-sm text-muted-foreground mt-1">
        {!hasWebsite
          ? 'Add your practice website URL to begin.'
          : !hasConnectedSocial
          ? 'Connect at least one social account to begin generating reports.'
          : 'Starting shortly…'}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground">{title}</h3>
          {body}
        </div>
        <div className="flex gap-2 shrink-0">
          {isComplete && (
            <Button variant="outline" size="sm" onClick={() => navigate('/knowledge-base')}>
              <BookOpen className="w-4 h-4 mr-2" />
              View
            </Button>
          )}
          {(status === 'error' || isComplete) && (
            <Button
              variant="outline"
              size="sm"
              disabled={trigger.isPending}
              onClick={() => trigger.mutate({ force: true })}
            >
              {trigger.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate'}
            </Button>
          )}
          {status === 'pending' && ready && (
            <Button
              size="sm"
              disabled={trigger.isPending}
              onClick={() => trigger.mutate({})}
            >
              {trigger.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-2" />}
              Start research
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResearchReportsBanner;
