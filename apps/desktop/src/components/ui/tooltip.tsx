import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const DEFAULT_TOOLTIP_DELAY_MS = 500;

type TooltipContextType = { open: boolean; toggle: () => void; close: () => void };

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
  open: propsOpen,
  preserveOnTrigger = false,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & { preserveOnTrigger?: boolean }) {
  const [internalOpen, setInternalOpen] = React.useState<boolean>(false);
  const open = propsOpen ?? internalOpen;

  const toggle = () => preserveOnTrigger && setInternalOpen(!open);
  const close = () => preserveOnTrigger && setInternalOpen(false);

  return (
    <TooltipContext.Provider value={{ open, toggle, close }}>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={open}
        onOpenChange={setInternalOpen}
        {...props}
      />
    </TooltipContext.Provider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const { close } = useTooltip();

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onPointerLeave={close}
      onBlur={close}
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
  const { close } = useTooltip();

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        onEscapeKeyDown={close}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-xs bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

function useTooltip() {
  const interactionRef = React.useContext(TooltipContext);
  if (!interactionRef) {
    throw new Error("TooltipTrigger and TooltipContent must be used within Tooltip");
  }
  return interactionRef;
}

export { DEFAULT_TOOLTIP_DELAY_MS, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
