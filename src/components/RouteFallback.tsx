import { Loader2 } from "lucide-react";

/**
 * Full-screen fallback shown while a lazy-loaded route chunk is fetched.
 * Kept intentionally lightweight so it ships in the initial (eager) bundle.
 */
export function RouteFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Loading
        </span>
      </div>
    </div>
  );
}
