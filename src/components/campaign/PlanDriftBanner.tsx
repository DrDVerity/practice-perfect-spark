/**
 * PlanDriftBanner, shown when the campaign's current inputs (budget total,
 * channels, addons, focus, dates) differ from the hash saved with the last
 * strategic plan. Clicking Refresh calls refresh-strategic-plan.
 */
import React from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  visible: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export default function PlanDriftBanner({ visible, onRefresh, isRefreshing }: Props) {
  if (!visible) return null;
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          Campaign inputs changed since the last strategic plan. Refresh the plan so budget and channel
          recommendations match your latest choices. Accepted blog and posts are preserved.
        </span>
      </div>
      <Button size="sm" onClick={onRefresh} disabled={isRefreshing}>
        {isRefreshing
          ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Refreshing…</>
          : <><RefreshCw className="w-4 h-4 mr-1" /> Refresh strategic plan</>}
      </Button>
    </div>
  );
}
