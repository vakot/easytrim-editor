import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const DEFAULT_TOOLTIP_DELAY_MS = 500;

interface TooltipInteractionContextValue {
  endTriggerInteraction: () => void;
  preserveTooltipDuringTriggerInteraction: () => void;
}

const TooltipInteractionContext = React.createContext<TooltipInteractionContextValue | null>(null);

interface TooltipProps extends React.ComponentProps<typeof TooltipPrimitive.Root> {
  closeOnTriggerClick?: boolean;
}

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
  closeOnTriggerClick = true,
  defaultOpen,
  onOpenChange,
  open: controlledOpen,
  ...props
}: TooltipProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const open = controlledOpen ?? uncontrolledOpen;
  const triggerInteractionRef = React.useRef(false);
  const preserveTooltipDuringTriggerInteraction = React.useCallback(() => {
    if (closeOnTriggerClick) return;
    triggerInteractionRef.current = true;
  }, [closeOnTriggerClick]);
  const endTriggerInteraction = React.useCallback(() => {
    triggerInteractionRef.current = false;
  }, []);
  const interactionContext = React.useMemo(
    () => ({ endTriggerInteraction, preserveTooltipDuringTriggerInteraction }),
    [endTriggerInteraction, preserveTooltipDuringTriggerInteraction],
  );

  React.useEffect(() => {
    if (!open || closeOnTriggerClick) endTriggerInteraction();
  }, [closeOnTriggerClick, endTriggerInteraction, open]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !closeOnTriggerClick && triggerInteractionRef.current) return;
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [closeOnTriggerClick, controlledOpen, onOpenChange],
  );

  return (
    <TooltipInteractionContext.Provider value={interactionContext}>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </TooltipInteractionContext.Provider>
  );
}

function TooltipTrigger({
  onBlur,
  onClick,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onWheel,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const interactionContext = React.useContext(TooltipInteractionContext);

  const preserveTooltip = () => {
    interactionContext?.preserveTooltipDuringTriggerInteraction();
  };

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onPointerDown={(event) => {
        preserveTooltip();
        onPointerDown?.(event);
      }}
      onClick={(event) => {
        preserveTooltip();
        onClick?.(event);
      }}
      onPointerLeave={(event) => {
        interactionContext?.endTriggerInteraction();
        onPointerLeave?.(event);
      }}
      onPointerCancel={(event) => {
        interactionContext?.endTriggerInteraction();
        onPointerCancel?.(event);
      }}
      onBlur={(event) => {
        const relatedTarget = event.relatedTarget;
        const focusRemainsWithinTrigger =
          relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget);
        if (!focusRemainsWithinTrigger) interactionContext?.endTriggerInteraction();
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") interactionContext?.endTriggerInteraction();
        onKeyDown?.(event);
      }}
      onWheel={(event) => {
        interactionContext?.endTriggerInteraction();
        onWheel?.(event);
      }}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const interactionContext = React.useContext(TooltipInteractionContext);

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        onEscapeKeyDown={(event) => {
          interactionContext?.endTriggerInteraction();
          onEscapeKeyDown?.(event);
        }}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-xs bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { DEFAULT_TOOLTIP_DELAY_MS, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
