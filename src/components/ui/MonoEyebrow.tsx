import * as React from "react";
import { cn } from "@/lib/utils";

interface MonoEyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  index?: string | number;
}

/**
 * Small uppercase IBM Plex Mono label used above section headings.
 * e.g. <MonoEyebrow index="01">Campaigns</MonoEyebrow>
 */
export const MonoEyebrow = React.forwardRef<HTMLSpanElement, MonoEyebrowProps>(
  ({ className, index, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-archer-steel",
        className,
      )}
      {...props}
    >
      {index !== undefined && (
        <>
          <span className="text-archer-gold-deep dark:text-archer-gold-light">
            {typeof index === "number" ? String(index).padStart(2, "0") : index}
          </span>
          <span aria-hidden className="h-px w-6 bg-border" />
        </>
      )}
      {children}
    </span>
  ),
);
MonoEyebrow.displayName = "MonoEyebrow";

export default MonoEyebrow;
