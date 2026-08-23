import { ChevronRight } from "lucide-react";
import { type ReactNode } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ContextMenuOption {
  id: string;
  leading?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (event: Event) => void;
  shouldCloseOnClick?: boolean;
  render?: (trigger: ReactNode) => ReactNode;
  openSubmenuOnClick?: boolean;
  submenuContent?: ReactNode;
  submenu?: readonly ContextMenuOption[];
}

interface ContextMenuProps {
  label: string;
  options: readonly ContextMenuOption[];
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onTriggerPointerEnter?: () => void;
}

export function ContextMenu({
  label,
  options,
  className,
  open,
  onOpenChange,
  onTriggerPointerEnter,
}: ContextMenuProps) {
  return (
    <DropdownMenuPrimitive.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onPointerEnter={onTriggerPointerEnter}
          className={cn(
            "text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground",
            className,
          )}
        >
          {label}
        </Button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          {options.map((option) => (
            <ContextMenuOptionItem key={option.id} option={option} />
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

function ContextMenuOptionItem({ option }: { option: ContextMenuOption }) {
  if (option.submenu || option.submenuContent) {
    return (
      <DropdownMenuPrimitive.Sub>
        <DropdownMenuPrimitive.SubTrigger
          disabled={option.disabled}
          onClick={(event) => {
            option.onSelect?.(event.nativeEvent);
            if (option.openSubmenuOnClick === false) event.preventDefault();
          }}
          data-selected={option.selected ? "true" : "false"}
          aria-current={option.selected ? "true" : undefined}
          className="flex min-h-8 min-w-48 w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        >
          <ContextMenuOptionContent option={option} />
          <ChevronRight className="ml-auto size-4 shrink-0" aria-hidden="true" />
        </DropdownMenuPrimitive.SubTrigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.SubContent
            sideOffset={4}
            alignOffset={-4}
            onFocusOutside={option.submenuContent ? (event) => event.preventDefault() : undefined}
            className="z-50 min-w-48 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          >
            {option.submenuContent ??
              option.submenu?.map((child) => (
                <ContextMenuOptionItem key={child.id} option={child} />
              ))}
          </DropdownMenuPrimitive.SubContent>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Sub>
    );
  }

  const item = (
    <DropdownMenuPrimitive.Item
      disabled={option.disabled}
      onSelect={(event) => {
        option.onSelect?.(event);
        if (option.shouldCloseOnClick === false) event.preventDefault();
      }}
      data-selected={option.selected ? "true" : "false"}
      aria-current={option.selected ? "true" : undefined}
      className="flex min-h-8 min-w-48 w-full cursor-default items-center gap-3 rounded-md px-2.5 py-1.5 text-left text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
    >
      <ContextMenuOptionContent option={option} />
    </DropdownMenuPrimitive.Item>
  );

  return option.render ? option.render(item) : item;
}

function ContextMenuOptionContent({ option }: { option: ContextMenuOption }) {
  return (
    <>
      {option.leading ? (
        <span className="flex shrink-0 items-center justify-center">{option.leading}</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {option.hint ? (
        <span className="ml-auto flex shrink-0 items-center justify-end gap-1.5 pl-6 text-xs text-muted-foreground">
          {option.hint}
        </span>
      ) : null}
    </>
  );
}
