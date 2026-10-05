import * as React from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { cn } from "@/lib/class-names.utils";

type ComboboxContextValue = {
  hasInputTriggerRef: React.MutableRefObject<boolean>;
  setOpen: (open: boolean) => void;
};

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null);
const ComboboxContentContext = React.createContext(false);

function useCombobox() {
  const context = React.useContext(ComboboxContext);

  if (!context) {
    throw new Error("Combobox components must be used within Combobox");
  }

  return context;
}

type ComboboxProps = Omit<
  React.ComponentProps<typeof Popover>,
  "open" | "defaultOpen" | "onOpenChange"
> & {
  commandProps?: Omit<React.ComponentProps<typeof Command>, "children">;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

function Combobox({
  children,
  commandProps,
  defaultOpen = false,
  onOpenChange,
  open: openProp,
  ...props
}: ComboboxProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);

  const open = openProp ?? uncontrolledOpen;
  const hasInputTriggerRef = React.useRef(false);

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (openProp === undefined) {
        setUncontrolledOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [openProp, onOpenChange],
  );

  return (
    <ComboboxContext.Provider
      value={{
        setOpen,
        hasInputTriggerRef,
      }}
    >
      <Command {...commandProps} className={cn("contents", commandProps?.className)}>
        <Popover onOpenChange={setOpen} open={open} {...props}>
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
  return <PopoverTrigger asChild={asChild} {...props} />;
}

function ComboboxAnchor({ asChild = true, ...props }: React.ComponentProps<typeof PopoverAnchor>) {
  return <PopoverAnchor asChild={asChild} {...props} />;
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
    return <ComboboxContentContext.Provider value>{children}</ComboboxContentContext.Provider>;
  }

  return (
    <PopoverContent
      align={align}
      className={cn("w-(--radix-popover-trigger-width) p-0", className)}
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
  onValueChange,
  ...props
}: React.ComponentProps<typeof CommandInput>) {
  const insideContent = React.useContext(ComboboxContentContext);
  const { hasInputTriggerRef, setOpen } = useCombobox();

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
        onValueChange={onValueChange}
        {...props}
      />
    );
  }

  return (
    <PopoverAnchor asChild>
      <CommandInput
        onClick={(event) => {
          onClick?.(event);

          if (!event.defaultPrevented) {
            setOpen(true);
          }
        }}
        onFocus={(event) => {
          onFocus?.(event);

          if (!event.defaultPrevented) {
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);

          if (!event.defaultPrevented && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            setOpen(true);
          }
        }}
        onValueChange={(value) => {
          onValueChange?.(value);
          setOpen(true);
        }}
        {...props}
      />
    </PopoverAnchor>
  );
}

function ComboboxList({ ...props }: React.ComponentProps<typeof CommandList>) {
  return <CommandList {...props} />;
}

function ComboboxEmpty({ ...props }: React.ComponentProps<typeof CommandEmpty>) {
  return <CommandEmpty {...props} />;
}

function ComboboxGroup({ ...props }: React.ComponentProps<typeof CommandGroup>) {
  return <CommandGroup {...props} />;
}

function ComboboxItem({ ...props }: React.ComponentProps<typeof CommandItem>) {
  return <CommandItem {...props} />;
}

function ComboboxSeparator({ ...props }: React.ComponentProps<typeof CommandSeparator>) {
  return <CommandSeparator {...props} />;
}

export {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
};
