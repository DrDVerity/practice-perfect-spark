/**
 * PublishPreflightDialog, checklist modal showing every preflight check.
 * Publish is enabled only when all checks pass.
 */
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Send } from 'lucide-react';
import type { PreflightResult } from '@/hooks/useCampaignAgent';

interface Props {
  open: boolean;
  onClose: () => void;
  result: PreflightResult | null;
  errorMessage?: string | null;
  isLoading?: boolean;
  isPublishing?: boolean;
  onPublish: () => void;
}

export default function PublishPreflightDialog({
  open, onClose, result, errorMessage, isLoading, isPublishing, onPublish,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish preflight</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Running checks…
          </div>
        ) : result ? (
          <div className="max-h-[420px] overflow-auto pr-1 space-y-2">
            {result.checks.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm">
                {c.ok
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  : <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                <div>
                  <div className={c.ok ? 'text-foreground' : 'text-foreground font-medium'}>{c.name}</div>
                  {!c.ok && c.message && (
                    <div className="text-xs text-muted-foreground mt-0.5">{c.message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <div className="font-medium text-foreground">Could not run preflight checks</div>
              <div className="mt-1 text-muted-foreground">
                {errorMessage || 'The backend returned an error before the checklist could be loaded.'}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPublishing}>Close</Button>
          <Button
            onClick={onPublish}
            disabled={!result?.ok || isPublishing || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPublishing
              ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Publishing…</>
              : <><Send className="w-4 h-4 mr-1" /> Publish now</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
