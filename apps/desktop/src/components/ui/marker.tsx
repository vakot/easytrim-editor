import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

const markerVariants = cva(
  "group/marker relative flex min-h-4 w-full items-center gap-2 text-left text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3 [a]:hover:text-foreground",
  {
    variants: {
      variant: {
        border: "border-b border-border pb-2",
        default: "",
        separator:
          "before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border",
      },
    },
  },
);

function Marker({
  asChild = false,
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof markerVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "div";

  return (
    <Comp
      className={cn(markerVariants({ className, variant }))}
      data-slot="marker"
      data-variant={variant}
      {...props}
    />
  );
}

function MarkerIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-4 shrink-0 [&_svg:not([class*='size-'])]:size-4", className)}
      data-slot="marker-icon"
      {...props}
    />
  );
}

function MarkerContent({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 flex-col wrap-break-word group-data-[variant=separator]/marker:flex-none group-data-[variant=separator]/marker:text-center *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      data-slot="marker-content"
      {...props}
    />
  );
}

function MarkerDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("flex min-w-0 items-center gap-1 text-xs text-muted-foreground", className)}
      data-slot="marker-description"
      {...props}
    />
  );
}

function MarkerAction({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("ml-auto shrink-0 self-start", className)}
      data-slot="marker-action"
      {...props}
    />
  );
}

export { Marker, MarkerAction, MarkerContent, MarkerDescription, MarkerIcon, markerVariants };
