"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/class-names.utils";

function Kbd({ children, className, ...props }: React.ComponentProps<"kbd">) {
  const content =
    children === "←" ? (
      <ArrowLeft aria-hidden="true" className="size-3" />
    ) : children === "→" ? (
      <ArrowRight aria-hidden="true" className="size-3" />
    ) : (
      children
    );

  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs leading-none font-medium text-muted-foreground in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10 [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      data-slot="kbd"
      {...props}
    >
      {content}
    </kbd>
  );
}

function KbdSeparator({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex w-3 shrink-0 justify-center font-mono text-xs", className)}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}

export { Kbd, KbdGroup, KbdSeparator };
