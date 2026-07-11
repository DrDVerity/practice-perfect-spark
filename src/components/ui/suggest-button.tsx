import { useState } from "react";
import { Sparkles, RefreshCw, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { suggestField, localFallback, type SuggestParams } from "@/lib/suggest";
import { cn } from "@/lib/utils";

interface SuggestButtonProps extends Omit<SuggestParams, "count"> {
  onSelect: (value: string) => void;
  count?: number;
  label?: string;
  /** Show only the sparkle icon (for tight inline spots). */
  iconOnly?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
}

/**
 * Drop-in "Suggest" button. Opens a popover with AI suggestions relevant to the
 * given field, sourced from the practice scan (with a local fallback so it's
 * always useful). Refetches each time it opens so results stay current.
 *
 * Usage:
 *   <SuggestButton field="campaign_focus" campaignId={id} userId={uid}
 *     context={{ practiceName }} onSelect={(v) => setFocus(v)} />
 */
export function SuggestButton({
  field,
  context,
  userId,
  campaignId,
  onSelect,
  count = 4,
  label = "Suggest",
  iconOnly = false,
  className,
  align = "end",
}: SuggestButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [salt, setSalt] = useState(0);
  const [usedFallback, setUsedFallback] = useState(false);

  const load = async (nextSalt = salt) => {
    setLoading(true);
    try {
      const results = await suggestField({ field, context, userId, campaignId, count });
      if (results.length) {
        setItems(results);
        setUsedFallback(false);
        return;
      }
      setItems(localFallback(field, context, count, nextSalt));
      setUsedFallback(true);
    } catch {
      setItems(localFallback(field, context, count, nextSalt));
      setUsedFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) load();
  };

  const refresh = () => {
    const next = salt + 1;
    setSalt(next);
    if (usedFallback) {
      setItems(localFallback(field, context, count, next));
    } else {
      load(next);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary",
            iconOnly && "h-8 w-8 p-0",
            className
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {!iconOnly && <span>{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-2">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-foreground">Suggestions</span>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
          </button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading your scan…
          </div>
        ) : items.length ? (
          <div className="grid gap-1">
            {items.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                }}
                className="group flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                <span className="flex-1">{s}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        ) : (
          <div className="px-2 py-4 text-sm text-muted-foreground">No suggestions right now.</div>
        )}
        {usedFallback && !loading && (
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">Starter ideas. Runs a live scan when connected.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
