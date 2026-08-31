import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

const markerVariants = cva(
  "group/marker relative min-h-4 w-full min-w-0 text-left text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3 [a]:hover:text-foreground",
  {
    variants: {
      variant: {
        border:
          "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 border-b border-border pb-2",
        default: "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2",
        separator:
          "flex items-center gap-2 before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border",
      },
    },
  },
);

const markerGroupVariants = cva(
  [
    "relative ml-2 flex flex-col pl-7",

    // Main vertical branch line — independent of gap.
    "before:absolute",
    "before:top-0",
    "before:bottom-4",
    "before:left-0",
    "before:border-l",
    "before:border-border",
  ],
  {
    variants: {
      variant: {
        branch: [
          "*:data-[slot=marker]:relative",

          // Rounded connector for every row.
          "*:data-[slot=marker]:after:absolute",
          "*:data-[slot=marker]:after:-left-7",
          "*:data-[slot=marker]:after:top-0",
          "*:data-[slot=marker]:after:h-2",
          "*:data-[slot=marker]:after:w-5",
          "*:data-[slot=marker]:after:rounded-bl-md",
          "*:data-[slot=marker]:after:border-b",
          "*:data-[slot=marker]:after:border-l",
          "*:data-[slot=marker]:after:border-border",
        ],
      },
    },
    defaultVariants: {
      variant: "branch",
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

function MarkerTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("h-4 leading-4", className)} data-slot="marker-title" {...props} />;
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
      className={cn(
        "flex w-full min-w-0 items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
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

function MarkerGroup({
  className,
  variant = "branch",
  ...props
}: React.ComponentProps<"div"> & { variant?: "branch" }) {
  return (
    <div
      className={cn(markerGroupVariants({ className, variant }))}
      data-slot="marker-group"
      {...props}
    />
  );
}

export {
  Marker,
  MarkerAction,
  MarkerContent,
  MarkerDescription,
  MarkerGroup,
  MarkerIcon,
  MarkerTitle,
  markerVariants,
};
