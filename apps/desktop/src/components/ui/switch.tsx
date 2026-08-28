"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names";

const switchVariants = cva(
  "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary",
  {
    variants: {
      size: {
        default: "h-5 w-9",
        sm: "h-4 w-7",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const thumbVariants: typeof switchVariants = cva(
  "pointer-events-none block  translate-x-0.5 rounded-full bg-background shadow-sm ring-0 transition-transform",
  {
    variants: {
      size: {
        default: "size-4 data-checked:translate-x-4",
        sm: "size-3 data-checked:translate-x-3",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & VariantProps<typeof switchVariants>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(switchVariants({ size, className }))}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        data-size={size}
        className={cn(thumbVariants({ size }))}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
