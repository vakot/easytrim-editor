import * as React from "react";
import { useTranslation } from "react-i18next";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { cn } from "@/lib/class-names.utils";

type ComboboxContextValue = {
  allowTriggerCloseRef: React.MutableRefObject<boolean>;
  hasInputTriggerRef: React.MutableRefObject<boolean>;
  openRef: React.MutableRefObject<boolean>;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
};

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null);
const ComboboxContentContext = React.createContext(false);
const ComboboxAsChildContentContext = React.createContext(false);

function useCombobox() {
  const context = React.useContext(ComboboxContext);

  if (!context) {
    throw new Error("Combobox components must be used within Combobox");
  }

  return context;
}

type ComboboxProps = Omit<React.ComponentProps<typeof Popover>, "open" | "onOpenChange"> & {
  label?: string;
  shouldFilter?: boolean;
};

function Combobox({
  children,
  defaultOpen = false,
  label,
  shouldFilter = true,
  ...props
}: ComboboxProps) {
  const { t } = useTranslation();
  const allowTriggerCloseRef = React.useRef(false);
  const hasInputTriggerRef = React.useRef(false);
  const openRef = React.useRef(defaultOpen);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  return (
    <ComboboxContext.Provider
      value={{
        allowTriggerCloseRef,
        hasInputTriggerRef,
        openRef,
        triggerRef,
      }}
    >
      <Command
        className="contents"
        label={label ?? t("common.labels.searchSuggestions")}
        shouldFilter={shouldFilter}
      >
        <Popover
          {...props}
          defaultOpen={defaultOpen}
          onOpenChange={(open) => {
            openRef.current = open;
          }}
        >
          {children}
        </Popover>
      </Command>
    </ComboboxContext.Provider>
  );
}

function ComboboxTrigger({
  asChild = true,
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  const { triggerRef } = useCombobox();

  return (
    <PopoverTrigger
      asChild={asChild}
      ref={(node) => {
        triggerRef.current = node;
      }}
      {...props}
    />
  );
}

function ComboboxContent({
  align = "start",
  asChild = false,
  children,
  className,
  onCloseAutoFocus,
  onOpenAutoFocus,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const { hasInputTriggerRef } = useCombobox();

  if (asChild) {
    return (
      <ComboboxAsChildContentContext.Provider value>
        <ComboboxContentContext.Provider value>{children}</ComboboxContentContext.Provider>
      </ComboboxAsChildContentContext.Provider>
    );
  }

  return (
    <PopoverContent
      align={align}
      className={cn("w-(--radix-popover-trigger-width) overflow-hidden p-0", className)}
      onCloseAutoFocus={(event) => {
        if (hasInputTriggerRef.current) {
          event.preventDefault();
        }

        onCloseAutoFocus?.(event);
      }}
      onOpenAutoFocus={(event) => {
        if (hasInputTriggerRef.current) {
          event.preventDefault();
        }

        onOpenAutoFocus?.(event);
      }}
      sideOffset={sideOffset}
      {...props}
    >
      <ComboboxContentContext.Provider value>{children}</ComboboxContentContext.Provider>
    </PopoverContent>
  );
}

function ComboboxInput({
  onClick,
  onFocus,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerUp,
  onValueChange,
  ...props
}: React.ComponentProps<typeof CommandInput>) {
  const insideContent = React.useContext(ComboboxContentContext);
  const { allowTriggerCloseRef, hasInputTriggerRef, openRef, triggerRef } = useCombobox();
  // Pointer focus arrives before the Radix trigger click; let that click toggle the popover once.
  const pointerDownRef = React.useRef(false);

  React.useEffect(() => {
    if (insideContent) {
      return;
    }

    hasInputTriggerRef.current = true;

    return () => {
      hasInputTriggerRef.current = false;
    };
  }, [insideContent, hasInputTriggerRef]);

  if (insideContent) {
    return (
      <CommandInput
        onClick={onClick}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onValueChange={onValueChange}
        {...props}
      />
    );
  }

  return (
    <PopoverTrigger
      asChild
      ref={(node) => {
        triggerRef.current = node;
      }}
    >
      <CommandInput
        onClick={(event) => {
          onClick?.(event);

          if (!event.defaultPrevented && !allowTriggerCloseRef.current && openRef.current) {
            event.preventDefault();
          }
        }}
        onFocus={(event) => {
          onFocus?.(event);

          if (!event.defaultPrevented) {
            event.currentTarget.select();

            if (!pointerDownRef.current && !openRef.current) {
              event.currentTarget.click();
            }
          }
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);

          if (
            !event.defaultPrevented &&
            (event.key === "ArrowDown" || event.key === "ArrowUp") &&
            !openRef.current
          ) {
            event.currentTarget.click();
          }
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event);
          pointerDownRef.current = false;
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);

          if (!event.defaultPrevented) {
            pointerDownRef.current = true;
          }
        }}
        onPointerUp={(event) => {
          onPointerUp?.(event);
          pointerDownRef.current = false;
        }}
        onValueChange={(value) => {
          onValueChange?.(value);
          if (!openRef.current) {
            triggerRef.current?.click();
          }
        }}
        {...props}
      />
    </PopoverTrigger>
  );
}

function ComboboxList({ className, ...props }: React.ComponentProps<typeof CommandList>) {
  return (
    <CommandList
      className={cn("mx-0! px-0! *:data-[slot=scroll-area-viewport]:max-h-72", className)}
      {...props}
    />
  );
}

function ComboboxEmpty({ ...props }: React.ComponentProps<typeof CommandEmpty>) {
  return <CommandEmpty {...props} />;
}

function ComboboxGroup({ ...props }: React.ComponentProps<typeof CommandGroup>) {
  return <CommandGroup {...props} />;
}

function ComboboxItem({ onSelect, ...props }: React.ComponentProps<typeof CommandItem>) {
  const insideAsChildContent = React.useContext(ComboboxAsChildContentContext);
  const { allowTriggerCloseRef, openRef, triggerRef } = useCombobox();

  return (
    <CommandItem
      onSelect={(value) => {
        onSelect?.(value);
        const trigger = triggerRef.current;

        if (!insideAsChildContent && trigger && openRef.current) {
          allowTriggerCloseRef.current = true;
          trigger.click();
          allowTriggerCloseRef.current = false;
        }
      }}
      {...props}
    />
  );
}

function ComboboxSeparator({ ...props }: React.ComponentProps<typeof CommandSeparator>) {
  return <CommandSeparator {...props} />;
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
};
