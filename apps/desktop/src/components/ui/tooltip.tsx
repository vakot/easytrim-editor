import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const DEFAULT_TOOLTIP_DELAY_MS = 500;

type TooltipContextType = {
  setPreservingTrigger: (preserving: boolean) => void;
};

const TooltipContext = React.createContext<TooltipContextType | null>(null);

function TooltipProvider({
  delayDuration = DEFAULT_TOOLTIP_DELAY_MS,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  open: controlledOpen,
  onOpenChange,
  preserveOnTrigger = false,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & {
  preserveOnTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const preservingTriggerRef = React.useRef(false);

  const open = controlledOpen ?? internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (!nextOpen && preservingTriggerRef.current) return;

    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  const setPreservingTrigger = (preserving: boolean) => {
    preservingTriggerRef.current = preserveOnTrigger && preserving;
  };

  return (
    <TooltipContext.Provider value={{ setPreservingTrigger }}>
      <TooltipPrimitive.Root data-slot="tooltip" open={open} onOpenChange={setOpen} {...props} />
    </TooltipContext.Provider>
  );
}

function TooltipTrigger({
  onPointerDown,
  onClick,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const { setPreservingTrigger } = useTooltip();

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onPointerDown={(event) => {
        setPreservingTrigger(true);
        onPointerDown?.(event);
      }}
      onClick={(event) => {
        onClick?.(event);
        queueMicrotask(() => setPreservingTrigger(false));
      }}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-xs bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

function useTooltip() {
  const context = React.useContext(TooltipContext);

  if (!context) {
    throw new Error("TooltipTrigger must be used within Tooltip");
  }

  return context;
}

export { DEFAULT_TOOLTIP_DELAY_MS, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
