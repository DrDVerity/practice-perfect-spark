import { useState } from "react";
import { Check, ArrowRight, ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SetupStep {
  key: string;
  title: string;
  desc: string;
  done: boolean;
  actionLabel: string;
  onAction: () => void;
}

/**
 * Persistent "next best action" guide shown on the dashboard until the
 * practice has completed the core journey (scan -> campaign -> content ->
 * connect -> publish). Detects completion live from real data passed in.
 */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("archer_checklist_dismissed") === "1"
  );

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;
  const nextIndex = steps.findIndex((s) => !s.done);

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem("archer_checklist_dismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {allDone ? "You're all set" : "Get set up"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {allDone
                ? "Your practice is fully launched. Nice work."
                : `${doneCount} of ${total} steps done. Here's what to do next.`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* progress ring */}
          <div className="relative mr-1 hidden h-11 w-11 sm:block">
            <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
              <circle cx="22" cy="22" r="18" className="fill-none stroke-muted" strokeWidth="4" />
              <circle
                cx="22"
                cy="22"
                r="18"
                className="fill-none stroke-primary transition-all duration-500"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={2 * Math.PI * 18 * (1 - doneCount / total)}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
              {Math.round((doneCount / total) * 100)}%
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          {allDone && (
            <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-border">
          <ol className="divide-y divide-border">
            {steps.map((s, i) => {
              const isNext = i === nextIndex;
              return (
                <li
                  key={s.key}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4",
                    isNext && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      s.done
                        ? "bg-primary text-primary-foreground"
                        : isNext
                        ? "border-2 border-primary text-primary"
                        : "border border-border text-muted-foreground"
                    )}
                  >
                    {s.done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-medium",
                          s.done ? "text-muted-foreground line-through" : "text-foreground"
                        )}
                      >
                        {s.title}
                      </span>
                      {isNext && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Next
                        </span>
                      )}
                    </div>
                    {!s.done && <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>}
                  </div>
                  {!s.done && (
                    <Button
                      size="sm"
                      variant={isNext ? "default" : "outline"}
                      onClick={s.onAction}
                      className="shrink-0 gap-1"
                    >
                      {s.actionLabel}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
