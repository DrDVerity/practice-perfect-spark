import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const seenKey = (id: string) => `archer_seen_${id}`;

/**
 * Tracks whether a section has changed since the user last acknowledged it.
 * Compares `updatedAt` against a per-user last-seen timestamp in localStorage.
 */
export function useSectionUpdated(id: string, updatedAt?: string | null) {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!updatedAt) {
      setIsNew(false);
      return;
    }
    let seen: number | null = null;
    try {
      const v = localStorage.getItem(seenKey(id));
      seen = v ? Number(v) : null;
    } catch {
      /* ignore */
    }
    const t = new Date(updatedAt).getTime();
    setIsNew(!seen || (Number.isFinite(t) && t > seen));
  }, [id, updatedAt]);

  const markSeen = () => {
    try {
      localStorage.setItem(seenKey(id), String(Date.now()));
    } catch {
      /* ignore */
    }
    setIsNew(false);
  };

  return { isNew, markSeen };
}

/**
 * Small pulsing "Updated" flag shown on a section that changed since last view.
 * Hover/click reveals what changed and when; clicking marks it seen.
 */
export function SectionUpdateFlag({
  id,
  updatedAt,
  changes,
  label = "Updated",
  className,
}: {
  id: string;
  updatedAt?: string | null;
  changes?: string[];
  label?: string;
  className?: string;
}) {
  const { isNew, markSeen } = useSectionUpdated(id, updatedAt);
  if (!isNew) return null;

  let rel = "";
  if (updatedAt) {
    try {
      rel = formatDistanceToNow(new Date(updatedAt), { addSuffix: true });
    } catch {
      rel = "";
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={markSeen}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary/20",
            className
          )}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="text-xs font-semibold text-foreground">What changed</div>
        {rel && <div className="mt-0.5 text-[11px] text-muted-foreground">Updated {rel}</div>}
        {changes && changes.length ? (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {changes.map((c, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-primary">&bull;</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">This section has new updates since you last looked.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
