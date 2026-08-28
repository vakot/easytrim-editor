"use client";

import { ChevronRight } from "lucide-react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/utils";

type MenuInteraction = "keyboard" | "pointer" | null;

const MenuInteractionContext = React.createContext<React.RefObject<MenuInteraction> | null>(null);

interface MenuSubmenuCoordinatorValue {
  closeSubmenu: () => void;
  openSubmenuId: string | null;
  setSubmenuOpen: (id: string, open: boolean) => void;
}

interface MenuSubContextValue {
  setOpen: (open: boolean) => void;
}

const MenuSubmenuCoordinatorContext = React.createContext<MenuSubmenuCoordinatorValue | null>(null);
const MenuSubContext = React.createContext<MenuSubContextValue | null>(null);

function Menu({ children, ...props }: React.ComponentProps<typeof MenuPrimitive.Root>) {
  const interactionRef = React.useRef<MenuInteraction>(null);

  return (
    <MenuInteractionContext.Provider value={interactionRef}>
      <MenuPrimitive.Root data-slot="menu" {...props}>
        {children}
      </MenuPrimitive.Root>
    </MenuInteractionContext.Provider>
  );
}

function MenuTrigger({
  onKeyDown,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
  const interactionRef = useMenuInteraction();

  return (
    <MenuPrimitive.Trigger
      data-slot="menu-trigger"
      onKeyDown={(event) => {
        interactionRef.current = "keyboard";
        onKeyDown?.(event);
      }}
      onPointerDown={(event) => {
        interactionRef.current = "pointer";
        onPointerDown?.(event);
      }}
      onPointerEnter={(event) => {
        interactionRef.current = "pointer";
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        interactionRef.current = "pointer";
        onPointerLeave?.(event);
      }}
      {...props}
    />
  );
}

function MenuContent({
  align = "start",
  className,
  onCloseAutoFocus,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  const interactionRef = useMenuInteraction();

  return (
    <MenuSubmenuCoordinator>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          data-slot="menu-content"
          align={align}
          sideOffset={sideOffset}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (!event.defaultPrevented && interactionRef.current === "pointer") {
              event.preventDefault();
            }
            interactionRef.current = null;
          }}
          className={cn(
            "z-50 min-w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Portal>
    </MenuSubmenuCoordinator>
  );
}

function MenuGroup(props: React.ComponentProps<typeof MenuPrimitive.Group>) {
  return <MenuPrimitive.Group data-slot="menu-group" {...props} />;
}

interface MenuItemProps extends React.ComponentProps<typeof MenuPrimitive.Item> {
  icon?: React.ReactNode;
  selected?: boolean;
  suffix?: React.ReactNode;
  tooltip?: React.ReactNode;
  tooltipProps?: React.ComponentProps<typeof TooltipContent> &
    Pick<React.ComponentProps<typeof Tooltip>, "preserveOnTrigger">;
}

const menuItemClassName =
  "flex min-h-6 min-w-48 w-full cursor-default items-center gap-2 rounded-sm px-2 text-left text-xs outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground focus:bg-accent focus:text-accent-foreground";

function MenuItem({
  "aria-current": ariaCurrent,
  children,
  className,
  disabled,
  icon,
  onPointerMove,
  selected = false,
  suffix,
  tooltip,
  tooltipProps: { preserveOnTrigger, ...tooltipProps } = {},
  ...props
}: MenuItemProps) {
  const submenuCoordinator = React.useContext(MenuSubmenuCoordinatorContext);
  const item = (
    <MenuPrimitive.Item
      data-slot="menu-item"
      data-selected={selected}
      aria-current={ariaCurrent ?? (selected ? "true" : undefined)}
      disabled={disabled}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!disabled && !event.defaultPrevented) submenuCoordinator?.closeSubmenu();
      }}
      className={cn(menuItemClassName, className)}
      {...props}
    >
      <MenuItemLayout icon={icon} suffix={suffix}>
        {children}
      </MenuItemLayout>
    </MenuPrimitive.Item>
  );

  if (tooltip === undefined) return item;

  return (
    <Tooltip preserveOnTrigger={preserveOnTrigger}>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent {...tooltipProps}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

interface MenuItemLayoutProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  submenu?: boolean;
  suffix?: React.ReactNode;
}

function MenuItemLayout({ children, icon, submenu = false, suffix }: MenuItemLayoutProps) {
  return (
    <>
      <span
        className="flex size-3 shrink-0 items-center justify-center text-muted-foreground"
        data-slot="menu-icon"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate" data-slot="menu-name">
        {children}
      </span>
      {suffix !== undefined ? (
        <span
          className="flex shrink-0 items-center justify-end text-xs text-muted-foreground"
          data-slot="menu-suffix"
        >
          {suffix}
        </span>
      ) : null}
      <span className="flex size-3 shrink-0 items-center justify-center" data-slot="menu-chevron">
        {submenu ? <ChevronRight className="size-3" aria-hidden="true" /> : null}
      </span>
    </>
  );
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn("my-0.5 mx-1.5 h-px bg-border", className)}
      {...props}
    />
  );
}

function MenuSub({
  children,
  defaultOpen = false,
  onOpenChange,
  open,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Sub>) {
  const id = React.useId();
  const submenuCoordinator = React.useContext(MenuSubmenuCoordinatorContext);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const defaultOpenAppliedRef = React.useRef(false);
  const resolvedOpen =
    open ?? (submenuCoordinator ? submenuCoordinator.openSubmenuId === id : internalOpen);

  React.useEffect(() => {
    if (defaultOpenAppliedRef.current || open !== undefined || !submenuCoordinator) return;
    defaultOpenAppliedRef.current = true;
    if (defaultOpen) submenuCoordinator.setSubmenuOpen(id, true);
  }, [defaultOpen, id, open, submenuCoordinator]);

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen);
      if (open !== undefined) return;
      if (submenuCoordinator) submenuCoordinator.setSubmenuOpen(id, nextOpen);
      else setInternalOpen(nextOpen);
    },
    [id, onOpenChange, open, submenuCoordinator],
  );
  const context = React.useMemo(() => ({ setOpen }), [setOpen]);

  return (
    <MenuSubContext.Provider value={context}>
      <MenuPrimitive.Sub data-slot="menu-sub" open={resolvedOpen} onOpenChange={setOpen} {...props}>
        {children}
      </MenuPrimitive.Sub>
    </MenuSubContext.Provider>
  );
}

interface MenuSubTriggerProps extends React.ComponentProps<typeof MenuPrimitive.SubTrigger> {
  icon?: React.ReactNode;
  selected?: boolean;
  suffix?: React.ReactNode;
}

function MenuSubTrigger({
  "aria-current": ariaCurrent,
  children,
  className,
  disabled,
  icon,
  onPointerMove,
  selected = false,
  suffix,
  ...props
}: MenuSubTriggerProps) {
  const submenu = React.useContext(MenuSubContext);
  if (!submenu) throw new Error("MenuSubTrigger must be used within MenuSub");

  return (
    <MenuPrimitive.SubTrigger
      data-slot="menu-sub-trigger"
      data-selected={selected}
      aria-current={ariaCurrent ?? (selected ? "true" : undefined)}
      disabled={disabled}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!disabled && !event.defaultPrevented) submenu.setOpen(true);
      }}
      className={cn(menuItemClassName, className)}
      {...props}
    >
      <MenuItemLayout icon={icon} suffix={suffix} submenu>
        {children}
      </MenuItemLayout>
    </MenuPrimitive.SubTrigger>
  );
}

function MenuSubContent({
  alignOffset = -4,
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuSubmenuCoordinator>
      <MenuPrimitive.Portal>
        <MenuPrimitive.SubContent
          data-slot="menu-sub-content"
          alignOffset={alignOffset}
          sideOffset={sideOffset}
          className={cn(
            "z-50 min-w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Portal>
    </MenuSubmenuCoordinator>
  );
}

function MenuSubmenuCoordinator({ children }: { children: React.ReactNode }) {
  const [openSubmenuId, setOpenSubmenuId] = React.useState<string | null>(null);
  const context = React.useMemo<MenuSubmenuCoordinatorValue>(
    () => ({
      closeSubmenu: () => setOpenSubmenuId(null),
      openSubmenuId,
      setSubmenuOpen: (id, open) => {
        setOpenSubmenuId((currentId) => {
          if (open) return id;
          return currentId === id ? null : currentId;
        });
      },
    }),
    [openSubmenuId],
  );

  return (
    <MenuSubmenuCoordinatorContext.Provider value={context}>
      {children}
    </MenuSubmenuCoordinatorContext.Provider>
  );
}

function useMenuInteraction() {
  const interactionRef = React.useContext(MenuInteractionContext);
  if (!interactionRef) {
    throw new Error("MenuTrigger and MenuContent must be used within Menu");
  }
  return interactionRef;
}

export {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
};
