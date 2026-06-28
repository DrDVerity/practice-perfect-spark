import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono",
  {
    variants: {
      variant: {
        default:
          "border-archer-gold-deep/30 bg-primary/15 text-archer-gold-deep dark:text-archer-gold-light",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        destructive:
          "border-status-danger-border bg-status-danger-bg text-status-danger-fg",
        outline: "border-border text-foreground",
        success:
          "border-status-success-border bg-status-success-bg text-status-success-fg",
        warning:
          "border-status-warning-border bg-status-warning-bg text-status-warning-fg",
        danger:
          "border-status-danger-border bg-status-danger-bg text-status-danger-fg",
        info: "border-status-info-border bg-status-info-bg text-status-info-fg",
        neutral:
          "border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
