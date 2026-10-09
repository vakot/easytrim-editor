"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

import styles from "./progress.module.css";

function Progress({
  "aria-valuetext": ariaValueText,
  className,
  indeterminate = false,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indeterminate?: boolean;
}) {
  return (
    <ProgressPrimitive.Root
      aria-valuetext={ariaValueText}
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-hidden rounded-full bg-muted",
        className,
      )}
      data-slot="progress"
      value={indeterminate ? null : value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full bg-primary",
          indeterminate ? styles.indeterminate : "w-full transition-transform duration-200",
        )}
        data-slot="progress-indicator"
        style={indeterminate ? undefined : { transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
