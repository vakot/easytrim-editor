import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

const menuContentClassName =
  "z-50 min-w-42 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95";

const menuLabelClassName = "px-1.5 py-1 text-xs font-medium data-inset:px-7";
const menuSeparatorClassName = "-mx-1 my-1 h-px bg-border";
const menuShortcutClassName = "ml-auto text-xs text-muted-foreground";

const menuItemVariants = cva(
  "group/menu-item relative flex h-6 min-w-42 cursor-default items-center rounded-md px-1.5 py-1 text-xs outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:px-7 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
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

type PreventableEvent = { preventDefault: () => void };

function gateKeepOpenHandler<T extends PreventableEvent>(
  keepOpen: boolean | undefined,
  handler: ((event: T) => void) | undefined,
): (event: T) => void {
  return (event) => {
    handler?.(event);

    // Radix composes CheckboxItem and RadioItem selection callbacks after the
    // consumer's handler. Let that default handling observe the live event,
    // then cancel only the menu dismissal at the selection boundary.
    if (keepOpen) event.preventDefault();
  };
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

const menuClassNames = {
  content: menuContentClassName,
  label: menuLabelClassName,
  separator: menuSeparatorClassName,
  shortcut: menuShortcutClassName,
};

export { gateKeepOpenHandler, menuClassNames, MenuIcon, menuItemVariants };
