"use client";

import { HoverCard as HoverCardPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

function HoverCard({
  defaultOpen = false,
  onOpenChange,
  open: controlledOpen,
  preserveOnTrigger = false,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root> & {
  preserveOnTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const preservingTriggerRef = React.useRef(false);
  const focusedWithinRef = React.useRef(false);

  const open = controlledOpen ?? internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (!nextOpen && (preservingTriggerRef.current || focusedWithinRef.current)) return;

    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  const setFocusedWithin = (focused: boolean) => {
    focusedWithinRef.current = focused;
  };

  const setPreservingTrigger = (preserving: boolean) => {
    preservingTriggerRef.current = preserveOnTrigger && preserving;
  };

  return (
    <HoverCardContext.Provider value={{ setPreservingTrigger, setFocusedWithin, setOpen }}>
      <HoverCardPrimitive.Root
        data-slot="hover-card"
        onOpenChange={setOpen}
        open={open}
        {...props}
      />
    </HoverCardContext.Provider>
  );
}

function HoverCardTrigger({
  onClick,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerUp,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  const { setPreservingTrigger } = useHoverCard();

  return (
    <HoverCardPrimitive.Trigger
      data-slot="hover-card-trigger"
      onClick={(event) => {
        setPreservingTrigger(true);
        onClick?.(event);
        queueMicrotask(() => setPreservingTrigger(false));
      }}
      onPointerCancel={(event) => {
        setPreservingTrigger(false);
        onPointerCancel?.(event);
      }}
      onPointerDown={(event) => {
        setPreservingTrigger(true);
        onPointerDown?.(event);
      }}
      onPointerLeave={(event) => {
        setPreservingTrigger(false);
        onPointerLeave?.(event);
      }}
      onPointerUp={(event) => {
        setPreservingTrigger(false);
        onPointerUp?.(event);
      }}
      {...props}
    />
  );
}

function HoverCardContent({
  align = "center",
  className,
  onBlurCapture,
  onFocusCapture,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  const { setFocusedWithin, setOpen } = useHoverCard();

  return (
    <HoverCardPrimitive.Portal data-slot="hover-card-portal">
      <HoverCardPrimitive.Content
        align={align}
        className={cn(
          "z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        data-slot="hover-card-content"
        onBlurCapture={(event) => {
          onBlurCapture?.(event);

          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocusedWithin(false);
            setOpen(false);
          }
        }}
        onFocusCapture={(event) => {
          onFocusCapture?.(event);
          setFocusedWithin(true);
        }}
        sideOffset={sideOffset}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

const HoverCardContext = React.createContext<{
  setFocusedWithin: (focusedWithin: boolean) => void;
  setOpen: (nextOpen: boolean) => void;
  setPreservingTrigger: (preserving: boolean) => void;
} | null>(null);

function useHoverCard() {
  const context = React.useContext(HoverCardContext);

  if (!context) {
    throw new Error("HoverCardTrigger must be used within HoverCard");
  }

  return context;
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
