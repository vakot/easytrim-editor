"use client";

import { Separator as SeparatorPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names";

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:w-full data-horizontal:h-px data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
