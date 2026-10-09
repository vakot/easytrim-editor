import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";

function MetricTooltip({
  ariaLabel,
  children,
  className,
  label,
}: {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={ariaLabel}
          className={cn("inline-flex shrink-0 items-center gap-0.5 py-1 tabular-nums", className)}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export { MetricTooltip };
