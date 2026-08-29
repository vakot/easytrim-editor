"use client";

import { ChevronRight } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";

type DropdownMenuInteraction = "keyboard" | "pointer" | null;

const DropdownMenuInteractionContext =
  React.createContext<React.RefObject<DropdownMenuInteraction> | null>(null);

interface DropdownMenuSubmenuCoordinatorValue {
  closeSubmenu: () => void;
  openSubmenuId: string | null;
  setSubmenuOpen: (id: string, open: boolean) => void;
}

interface DropdownMenuSubContextValue {
  setOpen: (open: boolean) => void;
}

const DropdownMenuSubmenuCoordinatorContext =
  React.createContext<DropdownMenuSubmenuCoordinatorValue | null>(null);

const DropdownMenuSubContext = React.createContext<DropdownMenuSubContextValue | null>(null);

function DropdownMenu({
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const interactionRef = React.useRef<DropdownMenuInteraction>(null);

  return (
    <DropdownMenuInteractionContext.Provider value={interactionRef}>
      <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props}>
        {children}
      </DropdownMenuPrimitive.Root>
    </DropdownMenuInteractionContext.Provider>
  );
}

function DropdownMenuTrigger({
  onKeyDown,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  const interactionRef = useDropdownMenuInteraction();

  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
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

function DropdownMenuContent({
  align = "start",
  alignOffset = -4,
  className,
  onCloseAutoFocus,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  const interactionRef = useDropdownMenuInteraction();

  return (
    <DropdownMenuSubmenuCoordinator>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          alignOffset={alignOffset}
          className={cn(
            "z-50 min-w-36 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            className,
          )}
          data-slot="dropdown-menu-content"
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (!event.defaultPrevented && interactionRef.current === "pointer") {
              event.preventDefault();
            }
            interactionRef.current = null;
          }}
          sideOffset={sideOffset}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuSubmenuCoordinator>
  );
}

function DropdownMenuGroup(props: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

interface DropdownMenuItemProps extends React.ComponentProps<typeof DropdownMenuPrimitive.Item> {
  icon?: React.ReactNode;
  inset?: boolean;
  selected?: boolean;
  suffix?: React.ReactNode;
  tooltip?: React.ReactNode;
  tooltipProps?: React.ComponentProps<typeof TooltipContent> &
    Pick<React.ComponentProps<typeof Tooltip>, "preserveOnTrigger">;
  variant?: "default" | "destructive";
}

const dropdownMenuItemClassName =
  "group/dropdown-menu-item relative flex min-w-48 cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-xs outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3 data-[variant=destructive]:*:[svg]:text-destructive!";

function DropdownMenuItem({
  "aria-current": ariaCurrent,
  children,
  className,
  disabled,
  icon,
  inset,
  onPointerMove,
  selected = false,
  suffix,
  tooltip,
  tooltipProps: { preserveOnTrigger, ...tooltipProps } = {},
  variant = "default",
  ...props
}: DropdownMenuItemProps) {
  const submenuCoordinator = React.useContext(DropdownMenuSubmenuCoordinatorContext);
  const item = (
    <DropdownMenuPrimitive.Item
      aria-current={ariaCurrent ?? (selected ? "true" : undefined)}
      className={cn(dropdownMenuItemClassName, className)}
      data-inset={inset}
      data-selected={selected}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      disabled={disabled}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!disabled && !event.defaultPrevented) submenuCoordinator?.closeSubmenu();
      }}
      {...props}
    >
      <DropdownMenuItemLayout icon={icon} suffix={suffix}>
        {children}
      </DropdownMenuItemLayout>
    </DropdownMenuPrimitive.Item>
  );

  if (tooltip === undefined) return item;

  return (
    <Tooltip preserveOnTrigger={preserveOnTrigger}>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent {...tooltipProps}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

interface DropdownMenuItemLayoutProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  submenu?: boolean;
  suffix?: React.ReactNode;
}

function DropdownMenuItemLayout({
  children,
  icon,
  submenu = false,
  suffix,
}: DropdownMenuItemLayoutProps) {
  return (
    <>
      <span
        className="flex size-3 shrink-0 items-center justify-center text-muted-foreground"
        data-slot="dropdown-menu-icon"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate" data-slot="dropdown-menu-name">
        {children}
      </span>
      {suffix !== undefined ? (
        <span
          className="flex shrink-0 items-center justify-end text-xs text-muted-foreground"
          data-slot="dropdown-menu-suffix"
        >
          {suffix}
        </span>
      ) : null}
      <span
        className="flex size-3 shrink-0 items-center justify-center"
        data-slot="dropdown-menu-chevron"
      >
        {submenu ? <ChevronRight aria-hidden="true" className="size-3" /> : null}
      </span>
    </>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

function DropdownMenuSub({
  children,
  defaultOpen = false,
  onOpenChange,
  open,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  const id = React.useId();
  const submenuCoordinator = React.useContext(DropdownMenuSubmenuCoordinatorContext);
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
    <DropdownMenuSubContext.Provider value={context}>
      <DropdownMenuPrimitive.Sub
        data-slot="dropdown-menu-sub"
        onOpenChange={setOpen}
        open={resolvedOpen}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Sub>
    </DropdownMenuSubContext.Provider>
  );
}

interface DropdownMenuSubTriggerProps extends React.ComponentProps<
  typeof DropdownMenuPrimitive.SubTrigger
> {
  icon?: React.ReactNode;
  inset?: boolean;
  selected?: boolean;
  suffix?: React.ReactNode;
}

function DropdownMenuSubTrigger({
  "aria-current": ariaCurrent,
  children,
  className,
  disabled,
  icon,
  inset,
  onPointerMove,
  selected = false,
  suffix,
  ...props
}: DropdownMenuSubTriggerProps) {
  const submenu = React.useContext(DropdownMenuSubContext);
  if (!submenu) throw new Error("DropdownMenuSubTrigger must be used within DropdownMenuSub");

  return (
    <DropdownMenuPrimitive.SubTrigger
      aria-current={ariaCurrent ?? (selected ? "true" : undefined)}
      className={cn(
        "group/dropdown-menu-item relative flex min-w-48 cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-xs outline-none select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      data-inset={inset}
      data-selected={selected}
      data-slot="dropdown-menu-sub-trigger"
      disabled={disabled}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!disabled && !event.defaultPrevented) submenu.setOpen(true);
      }}
      {...props}
    >
      <DropdownMenuItemLayout icon={icon} submenu suffix={suffix}>
        {children}
      </DropdownMenuItemLayout>
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  alignOffset = -4,
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuSubmenuCoordinator>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.SubContent
          alignOffset={alignOffset}
          className={cn(
            "z-50 min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          data-slot="dropdown-menu-sub-content"
          sideOffset={sideOffset}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuSubmenuCoordinator>
  );
}

function DropdownMenuSubmenuCoordinator({ children }: { children: React.ReactNode }) {
  const [openSubmenuId, setOpenSubmenuId] = React.useState<string | null>(null);
  const context = React.useMemo<DropdownMenuSubmenuCoordinatorValue>(
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
    <DropdownMenuSubmenuCoordinatorContext.Provider value={context}>
      {children}
    </DropdownMenuSubmenuCoordinatorContext.Provider>
  );
}

function useDropdownMenuInteraction() {
  const interactionRef = React.useContext(DropdownMenuInteractionContext);
  if (!interactionRef) {
    throw new Error("DropdownMenuTrigger and DropdownMenuContent must be used within DropdownMenu");
  }
  return interactionRef;
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
