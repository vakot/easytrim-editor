import { ChevronRight } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContextMenuItem {
  id: string;
  className?: string;
}

interface ContextMenuItemOption extends ContextMenuItem {
  children: ReactNode;
  icon?: ReactNode;
  suffix?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  ariaKeyShortcuts?: string;
  onSelect?: (event: Event) => void;
  shouldCloseOnClick?: boolean;
}

interface ContextMenuItemCustom extends ContextMenuItem {
  render: () => ReactNode;
}

interface ContextMenuItemSubmenu extends ContextMenuItemOption {
  options: readonly ContextMenuOption[];
}

export interface ContextMenuSeparatorOption extends ContextMenuItem {
  separator: true;
}

export type ContextMenuOption =
  | ContextMenuItemOption
  | ContextMenuSeparatorOption
  | ContextMenuItemSubmenu
  | ContextMenuItemCustom;

interface ContextMenuProps {
  children: ReactNode;
  options: readonly ContextMenuOption[];
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onTriggerPointerEnter?: () => void;
}

export function ContextMenu({
  children,
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
          size="xs"
          onPointerEnter={onTriggerPointerEnter}
          className={cn(
            "text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground",
            className,
          )}
        >
          {children}
        </Button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
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
        <DropdownMenuPrimitive.Separator key={option.id} className="my-0.5 mx-1.5 h-px bg-border" />
      );
    }

    if (isContextMenuSubMenu(option)) {
      return (
        <ContextMenuSubmenuOptionItem
          key={option.id}
          option={option}
          open={openSubmenuId === option.id}
          onOpenChange={(isOpen) => setSubmenuOpen(option.id, isOpen)}
        />
      );
    }

    if (isContextMenuCustom(option)) {
      return <Fragment key={option.id}>{option.render()}</Fragment>;
    }

    return <ContextMenuOptionItem key={option.id} option={option} onPointerMove={closeSubmenu} />;
  });
}

function isContextMenuSeparator(option: ContextMenuOption): option is ContextMenuSeparatorOption {
  return "separator" in option;
}

function isContextMenuSubMenu(option: ContextMenuOption): option is ContextMenuItemSubmenu {
  return "options" in option;
}

function isContextMenuCustom(option: ContextMenuOption): option is ContextMenuItemCustom {
  return "render" in option;
}

const CONTEXT_MENU_CLASS_NAME =
  "flex min-h-6 min-w-48 w-full cursor-default items-center rounded-sm px-2 text-left text-xs outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground focus:bg-accent focus:text-accent-foreground";

function ContextMenuOptionItem({
  option,
  onPointerMove,
}: {
  option: ContextMenuItemOption;
  onPointerMove: () => void;
}) {
  return (
    <DropdownMenuPrimitive.Item
      disabled={option.disabled}
      aria-keyshortcuts={option.ariaKeyShortcuts}
      onPointerMove={option.disabled ? undefined : onPointerMove}
      onSelect={(event) => {
        option.onSelect?.(event);
        if (option.shouldCloseOnClick === false) event.preventDefault();
      }}
      data-selected={option.selected ? "true" : "false"}
      aria-current={option.selected ? "true" : undefined}
      className={CONTEXT_MENU_CLASS_NAME}
    >
      <ContextMenuItemPrimitive icon={option.icon} suffix={option.suffix}>
        {option.children}
      </ContextMenuItemPrimitive>
    </DropdownMenuPrimitive.Item>
  );
}

function ContextMenuSubmenuOptionItem({
  option,
  open,
  onOpenChange,
}: {
  option: ContextMenuItemSubmenu;
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <DropdownMenuPrimitive.Sub open={open} onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.SubTrigger
        disabled={option.disabled}
        onPointerMove={(event) => {
          if (!option.disabled && !event.defaultPrevented) onOpenChange(true);
        }}
        onClick={(event) => {
          option.onSelect?.(event.nativeEvent);
        }}
        data-selected={option.selected ? "true" : "false"}
        aria-current={option.selected ? "true" : undefined}
        className={CONTEXT_MENU_CLASS_NAME}
      >
        <ContextMenuItemPrimitive icon={option.icon} suffix={option.suffix} chevron>
          {option.children}
        </ContextMenuItemPrimitive>
      </DropdownMenuPrimitive.SubTrigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.SubContent
          sideOffset={4}
          alignOffset={-4}
          className="z-50 min-w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          <ContextMenuOptionList options={option.options} />
        </DropdownMenuPrimitive.SubContent>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Sub>
  );
}

function ContextMenuItemPrimitive({
  icon,
  children,
  suffix,
  chevron = false,
}: {
  icon?: ReactNode;
  children: ReactNode;
  suffix?: ReactNode;
  chevron?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <span
        className="flex size-3 shrink-0 items-center justify-center text-muted-foreground"
        data-slot="menu-icon"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate" data-slot="menu-name">
        {children}
      </span>
      {suffix ? (
        <span
          className="flex shrink-0 items-center justify-end text-xs text-muted-foreground"
          data-slot="menu-suffix"
        >
          {suffix}
        </span>
      ) : null}
      <span className="flex size-3 shrink-0 items-center justify-center" data-slot="menu-chevron">
        {chevron ? <ChevronRight className="size-3" aria-hidden="true" /> : null}
      </span>
    </div>
  );
}
