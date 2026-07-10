import { useEffect, useRef, useState, Fragment } from "react";
import { Check, ShieldCheck, Clock } from "lucide-react";

const prefersReduced =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface ProcessingTerminalProps {
  /** Scripted lines to stream. Purely cosmetic; decoupled from the real job. */
  steps: string[];
  /** True while the real async job is still in flight. */
  running: boolean;
  /** Flip to true when the real job resolves. Drives the final 100% + onComplete. */
  done?: boolean;
  /** Minimum wall-clock time the animation is allowed to run (ms). */
  minDurationMs?: number;
  title?: string;
  footnote?: string;
  etaLabel?: string;
  /** Fires once, after the script has played AND the job is done AND min time elapsed. */
  onComplete?: () => void;
  className?: string;
}

/** Highlight domains, urls and "<n> word" counts in gold, like the concept. */
function renderLine(text: string) {
  const parts = text.split(
    /((?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?|\b\d+\b)/gi
  );
  return parts.map((p, i) =>
    /^(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.test(p) || /^\d+$/.test(p) ? (
      <span key={i} className="text-gold-300">
        {p}
      </span>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    )
  );
}

export function ProcessingTerminal({
  steps,
  running,
  done = false,
  minDurationMs = 6000,
  title = "archer://scan",
  footnote = "Your data is encrypted and never shared.",
  etaLabel,
  onComplete,
  className,
}: ProcessingTerminalProps) {
  const [typed, setTyped] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [pct, setPct] = useState(0);
  const [finished, setFinished] = useState(false);

  const doneRef = useRef(done);
  doneRef.current = done;
  const completedRef = useRef(false);

  useEffect(() => {
    if (!running && !done) return;
    let cancelled = false;
    const startedAt = Date.now();
    const lines: string[] = [];
    let idx = 0;

    const setProgress = () => {
      const base = Math.round((lines.length / Math.max(1, steps.length)) * 92);
      setPct((prev) => Math.max(prev, Math.min(92, base)));
    };

    const finalize = () => {
      if (cancelled || completedRef.current) return;
      const elapsed = Date.now() - startedAt;
      if (doneRef.current && elapsed >= minDurationMs) {
        completedRef.current = true;
        setPct(100);
        setFinished(true);
        onComplete?.();
      } else {
        setTimeout(finalize, 180);
      }
    };

    const typeLine = (line: string, after: () => void) => {
      if (prefersReduced) {
        after();
        return;
      }
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i += 1;
        setCurrent(line.slice(0, i));
        if (i < line.length) {
          setTimeout(tick, 10 + Math.random() * 26);
        } else {
          setTimeout(after, 110);
        }
      };
      tick();
    };

    const next = () => {
      if (cancelled) return;
      if (idx >= steps.length) {
        setCurrent("");
        finalize();
        return;
      }
      const line = steps[idx];
      const fastForward = doneRef.current; // job already done, race to the end
      typeLine(line, () => {
        if (cancelled) return;
        lines.push(line);
        setTyped([...lines]);
        setCurrent("");
        setProgress();
        idx += 1;
        const pause = fastForward ? 45 : 240 + Math.random() * 360;
        setTimeout(next, pause);
      });
    };

    next();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <div className={`onb-term rounded-2xl p-5 sm:p-7 ${className ?? ""}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
          <span className="ml-3 font-mono text-xs text-ink-300">{title}</span>
        </div>
        <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-300 sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-gold" /> Enterprise security
        </span>
      </div>

      <div className="min-h-[168px] space-y-2 font-mono text-sm leading-relaxed sm:text-base">
        {typed.map((line, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="select-none text-gold">&gt;</span>
            <span className="flex-1 text-[color:var(--ink-050)]">{renderLine(line)}</span>
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400/80" />
          </div>
        ))}
        {!finished && (
          <div className="flex items-start gap-2">
            <span className="select-none text-gold">&gt;</span>
            <span className="flex-1 text-[color:var(--ink-050)]">
              {renderLine(current)}
              <span className="term-cursor" aria-hidden="true" />
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="term-bar-fill h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-300">
            <ShieldCheck className="h-3.5 w-3.5" /> {footnote}
          </span>
          <span className="flex items-center gap-2 font-mono text-sm font-semibold text-gold">
            {etaLabel && !finished && (
              <span className="hidden items-center gap-1 text-[11px] font-normal text-ink-300 sm:flex">
                <Clock className="h-3.5 w-3.5" /> {etaLabel}
              </span>
            )}
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}
