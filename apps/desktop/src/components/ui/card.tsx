import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

const cardVariants = cva(
  "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl border border-transparent py-(--card-spacing) text-sm text-card-foreground ring-1 outline-none [--card-spacing:--spacing(4)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
  {
    variants: {
      variant: {
        default: "bg-card ring-foreground/10",
        destructive: "bg-destructive/5 ring-destructive/45",
        success: "bg-success/5 ring-success/45",
        warning: "bg-warning/5 ring-warning/45",
        active: "bg-primary/5 ring-2 ring-primary/45",
      },
      hoverable: {
        false: "",
        true: "",
      },
    },
    compoundVariants: [
      { class: "hover:bg-foreground/10", hoverable: true, variant: "default" },
      { class: "hover:bg-destructive/10", hoverable: true, variant: "destructive" },
      { class: "hover:bg-success/10", hoverable: true, variant: "success" },
      { class: "hover:bg-warning/10", hoverable: true, variant: "warning" },
      { class: "hover:bg-primary/10", hoverable: true, variant: "active" },
    ],
    defaultVariants: {
      variant: "default",
    },
  },
);

function Card({
  className,
  hoverable = false,
  size = "default",
  variant,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof cardVariants> & { hoverable?: boolean; size?: "default" | "sm" }) {
  const resolvedVariant = variant ?? "default";

  return (
    <div
      className={cn(cardVariants({ variant: resolvedVariant, hoverable }), className)}
      data-size={size}
      data-slot="card"
      data-variant={resolvedVariant}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className,
      )}
      data-slot="card-header"
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className,
      )}
      data-slot="card-title"
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-xs text-muted-foreground", className)}
      data-slot="card-description"
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      data-slot="card-action"
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("px-(--card-spacing)", className)} data-slot="card-content" {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className,
      )}
      data-slot="card-footer"
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cardVariants,
};
