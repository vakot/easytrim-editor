import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

const emptyMediaVariants = cva("flex shrink-0 items-center justify-center", {
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "size-10 rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-5",
      illustration: "size-16 rounded-lg bg-muted text-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-6 rounded-lg border border-dashed p-6 text-center",
        className,
      )}
      data-slot="empty"
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex max-w-sm flex-col items-center gap-2 text-center", className)}
      data-slot="empty-header"
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-lg font-medium tracking-tight", className)}
      data-slot="empty-title"
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="empty-description"
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full max-w-md flex-col items-center gap-4", className)}
      data-slot="empty-content"
      {...props}
    />
  );
}

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      className={cn(emptyMediaVariants({ variant }), className)}
      data-slot="empty-media"
      data-variant={variant}
      {...props}
    />
  );
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
