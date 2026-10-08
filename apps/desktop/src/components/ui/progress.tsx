"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

function Progress({
  "aria-valuetext": ariaValueText,
  className,
  indeterminate = false,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { indeterminate?: boolean }) {
  return (
    <ProgressPrimitive.Root
      aria-valuetext={ariaValueText}
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className,
      )}
      data-slot="progress"
      value={indeterminate ? null : value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "bg-primary transition-all",
          indeterminate ? "h-full w-1/3 animate-pulse" : "size-full flex-1",
        )}
        data-slot="progress-indicator"
        style={{
          transform: indeterminate ? "translateX(0)" : `translateX(-${100 - (value || 0)}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
