import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContextMenuItemOption {
  id: string;
  leading?: ReactNode;
  label: ReactNode;
  ariaLabel?: string;
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

export interface ContextMenuSeparatorOption {
  id: string;
  separator: true;
}

export type ContextMenuOption = ContextMenuItemOption | ContextMenuSeparatorOption;

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
          <ContextMenuOptionList options={options} />
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

function ContextMenuOptionList({ options }: { options: readonly ContextMenuOption[] }) {
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);

  const setSubmenuOpen = (id: string, isOpen: boolean) => {
    setOpenSubmenuId((currentId) => {
      if (isOpen) return id;
      return currentId === id ? null : currentId;
    });
  };

  const closeSubmenu = () => setOpenSubmenuId(null);

  return options.map((option) => {
    if (isContextMenuSeparator(option)) {
      return (
        <DropdownMenuPrimitive.Separator key={option.id} className="my-1 mx-2 h-px bg-border" />
      );
    }

    return (
      <ContextMenuOptionItem
        key={option.id}
        option={option}
        open={openSubmenuId === option.id}
        onOpenChange={(isOpen) => setSubmenuOpen(option.id, isOpen)}
        onPointerMove={closeSubmenu}
      />
    );
  });
}

function isContextMenuSeparator(option: ContextMenuOption): option is ContextMenuSeparatorOption {
  return "separator" in option;
}

function ContextMenuOptionItem({
  option,
  open,
  onOpenChange,
  onPointerMove,
}: {
  option: ContextMenuItemOption;
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPointerMove: () => void;
}) {
  if (option.submenu || option.submenuContent) {
    return <ContextMenuSubmenuOptionItem option={option} open={open} onOpenChange={onOpenChange} />;
  }

  const item = (
    <DropdownMenuPrimitive.Item
      disabled={option.disabled}
      onPointerMove={option.disabled ? undefined : onPointerMove}
      onSelect={(event) => {
        option.onSelect?.(event);
        if (option.shouldCloseOnClick === false) event.preventDefault();
      }}
      data-selected={option.selected ? "true" : "false"}
      aria-label={option.ariaLabel}
      aria-current={option.selected ? "true" : undefined}
      className="flex min-h-8 min-w-48 w-full cursor-default items-center rounded-md px-2.5 py-1.5 text-left text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
    >
      <ContextMenuItemLayout icon={option.leading} name={option.label} suffix={option.hint} />
    </DropdownMenuPrimitive.Item>
  );

  return option.render ? option.render(item) : item;
}

function ContextMenuSubmenuOptionItem({
  option,
  open,
  onOpenChange,
}: {
  option: ContextMenuItemOption;
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const instantSwitch = option.openSubmenuOnClick !== false;

  return (
    <DropdownMenuPrimitive.Sub open={open} onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.SubTrigger
        disabled={option.disabled}
        onPointerMove={
          instantSwitch
            ? (event) => {
                if (!option.disabled && !event.defaultPrevented) onOpenChange(true);
              }
            : undefined
        }
        onClick={(event) => {
          option.onSelect?.(event.nativeEvent);
          if (!instantSwitch) {
            onOpenChange(false);
            event.preventDefault();
          }
        }}
        data-selected={option.selected ? "true" : "false"}
        aria-current={option.selected ? "true" : undefined}
        className="flex min-h-8 min-w-56 w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
      >
        <ContextMenuItemLayout
          icon={option.leading}
          name={option.label}
          suffix={option.hint}
          chevron
        />
      </DropdownMenuPrimitive.SubTrigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.SubContent
          sideOffset={4}
          alignOffset={-4}
          onFocusOutside={option.submenuContent ? (event) => event.preventDefault() : undefined}
          className="z-50 min-w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          {option.submenuContent ??
            (option.submenu ? <ContextMenuOptionList options={option.submenu} /> : null)}
        </DropdownMenuPrimitive.SubContent>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Sub>
  );
}

function ContextMenuItemLayout({
  icon,
  name,
  suffix,
  chevron = false,
}: {
  icon?: ReactNode;
  name: ReactNode;
  suffix?: ReactNode;
  chevron?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="flex size-4 shrink-0 items-center justify-center" data-slot="menu-icon">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate" data-slot="menu-name">
        {name}
      </span>
      {suffix ? (
        <span
          className="flex shrink-0 items-center justify-end text-xs text-muted-foreground"
          data-slot="menu-suffix"
        >
          {suffix}
        </span>
      ) : null}
      <span className="flex size-4 shrink-0 items-center justify-center" data-slot="menu-chevron">
        {chevron ? <ChevronRight className="size-4" aria-hidden="true" /> : null}
      </span>
    </div>
  );
}
