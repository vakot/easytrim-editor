import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

const menuContentClassName =
  "z-50 min-w-36 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95";

const menuSubContentClassName =
  "z-50 min-w-32 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

const menuItemVariants = cva(
  "group/menu-item relative flex h-6 min-w-36 cursor-default items-center gap-8 rounded-md px-1.5 py-1 text-xs outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:px-7 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      kind: {
        item: "",
        checkbox: "pl-7",
        radio: "pl-7",
        subTrigger: "data-open:bg-accent data-open:text-accent-foreground",
      },
      variant: {
        default: "",
        success:
          "text-success focus:bg-success/10 focus:text-success dark:focus:bg-success/20 [&_svg]:text-success!",
        destructive:
          "text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20 [&_svg]:text-destructive!",
      },
    },
    defaultVariants: {
      kind: "item",
      variant: "default",
    },
  },
);

const menuLabelClassName = "px-1.5 py-1 text-xs font-medium data-inset:px-7";
const menuSeparatorClassName = "-mx-1 my-1 h-px bg-border";
const menuShortcutClassName =
  "ml-auto text-xs tracking-widest text-muted-foreground group-focus/menu-item:text-accent-foreground";

const KEEP_OPEN_HANDLER_KEYS = [
  "onAuxClick",
  "onClick",
  "onContextMenu",
  "onDoubleClick",
  "onKeyDown",
  "onKeyUp",
  "onMouseDown",
  "onMouseUp",
  "onPointerDown",
  "onPointerUp",
  "onTouchEnd",
  "onTouchStart",
] as const;

type PreventableEvent = { preventDefault: () => void };

function gateKeepOpenHandler<T extends PreventableEvent>(
  keepOpen: boolean | undefined,
  handler: ((event: T) => void) | undefined,
): (event: T) => void {
  return (event) => {
    if (keepOpen) event.preventDefault();
    handler?.(event);
  };
}

function gateKeepOpenHandlers<T extends object>(
  props: T,
  keepOpen: boolean | undefined,
  hasSelectionHandler: boolean,
): T {
  // Radix uses onSelect as the dismissal boundary. Preventing earlier events
  // would also suppress internal checkbox/radio updates and asChild handlers.
  if (!keepOpen || hasSelectionHandler) return props;

  const gatedProps = { ...props } as T & Record<(typeof KEEP_OPEN_HANDLER_KEYS)[number], unknown>;

  for (const key of KEEP_OPEN_HANDLER_KEYS) {
    const handler = gatedProps[key];
    if (typeof handler !== "function") continue;

    gatedProps[key] = gateKeepOpenHandler(keepOpen, handler as (event: PreventableEvent) => void);
  }

  return gatedProps as T;
}

function MenuIcon({
  children,
  className,
  side = "left",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { side?: "left" | "right" }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute flex size-3 items-center justify-center text-muted-foreground [&_svg:not([class*='size-'])]:size-3",
        side === "left" ? "left-1.5" : "right-1.5",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export {
  gateKeepOpenHandler,
  gateKeepOpenHandlers,
  menuContentClassName,
  MenuIcon,
  menuItemVariants,
  menuLabelClassName,
  menuSeparatorClassName,
  menuShortcutClassName,
  menuSubContentClassName,
};
