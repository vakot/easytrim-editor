import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { Menubar as MenubarPrimitive } from "radix-ui";
import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";

function Menubar({ className, ...props }: React.ComponentProps<typeof MenubarPrimitive.Root>) {
  return (
    <MenubarPrimitive.Root
      className={cn("flex h-8 items-center gap-0.5 rounded-lg border p-0.75", className)}
      data-slot="menubar"
      {...props}
    />
  );
}

function MenubarMenu({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu data-slot="menubar-menu" {...props} />;
}

function MenubarGroup({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Group>) {
  return <MenubarPrimitive.Group data-slot="menubar-group" {...props} />;
}

function MenubarPortal({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Portal>) {
  return <MenubarPrimitive.Portal data-slot="menubar-portal" {...props} />;
}

function MenubarRadioGroup({ ...props }: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>) {
  return <MenubarPrimitive.RadioGroup data-slot="menubar-radio-group" {...props} />;
}

function MenubarTrigger({
  className,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Trigger>) {
  return (
    <MenubarPrimitive.Trigger
      className={cn(
        "flex items-center rounded-sm px-1.5 py-0.5 text-sm font-medium outline-hidden select-none hover:bg-muted aria-expanded:bg-muted",
        className,
      )}
      data-slot="menubar-trigger"
      {...props}
    />
  );
}

function MenubarContent({
  align = "start",
  alignOffset = -4,
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Content>) {
  return (
    <MenubarPortal>
      <MenubarPrimitive.Content
        align={align}
        alignOffset={alignOffset}
        className={cn(
          "z-50 min-w-36 origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          className,
        )}
        data-slot="menubar-content"
        sideOffset={sideOffset}
        {...props}
      />
    </MenubarPortal>
  );
}

interface MenubarItemProps extends React.ComponentProps<typeof MenubarPrimitive.Item> {
  icon?: React.ReactNode;
  inset?: boolean;
  selected?: boolean;
  tooltip?: React.ReactNode;
  tooltipProps?: React.ComponentProps<typeof TooltipContent> &
    Pick<React.ComponentProps<typeof Tooltip>, "preserveOnTrigger">;
  variant?: "default" | "destructive";
}

function MenubarItem({
  "aria-current": ariaCurrent,
  children,
  className,
  disabled,
  icon,
  inset,
  selected = false,
  tooltip,
  tooltipProps: { preserveOnTrigger, ...tooltipProps } = {},
  variant = "default",
  ...props
}: MenubarItemProps) {
  const item = (
    <MenubarPrimitive.Item
      aria-current={ariaCurrent ?? (selected ? "true" : undefined)}
      className={cn(
        "group/menubar-item relative flex min-w-48 cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-xs outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3 data-[variant=destructive]:*:[svg]:text-destructive!",
        className,
      )}
      data-inset={inset}
      data-selected={selected}
      data-slot="menubar-item"
      data-variant={variant}
      disabled={disabled}
      {...props}
    >
      <MenubarItemLayout icon={icon}>{children}</MenubarItemLayout>
    </MenubarPrimitive.Item>
  );

  if (tooltip === undefined) return item;

  return (
    <Tooltip preserveOnTrigger={preserveOnTrigger}>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent {...tooltipProps}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

interface MenubarItemLayoutProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  submenu?: boolean;
}

function MenubarItemLayout({ children, icon, submenu = false }: MenubarItemLayoutProps) {
  return (
    <>
      <span
        className="flex size-3 shrink-0 items-center justify-center text-muted-foreground"
        data-slot="menubar-icon"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 items-center truncate" data-slot="menubar-name">
        {children}
      </span>
      <span
        className="flex size-3 shrink-0 items-center justify-center"
        data-slot="menubar-chevron"
      >
        {submenu ? <ChevronRightIcon aria-hidden="true" className="size-3" /> : null}
      </span>
    </>
  );
}

function MenubarCheckboxItem({
  checked,
  children,
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.CheckboxItem> & {
  inset?: boolean;
}) {
  return (
    <MenubarPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-1.5 pl-7 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-inset={inset}
      data-slot="menubar-checkbox-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-1.5 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  );
}

function MenubarRadioItem({
  children,
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioItem> & {
  inset?: boolean;
}) {
  return (
    <MenubarPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-1.5 pl-7 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-inset={inset}
      data-slot="menubar-radio-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-1.5 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.RadioItem>
  );
}

function MenubarLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <MenubarPrimitive.Label
      className={cn("px-1.5 py-1 text-sm font-medium data-inset:pl-7", className)}
      data-inset={inset}
      data-slot="menubar-label"
      {...props}
    />
  );
}

function MenubarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Separator>) {
  return (
    <MenubarPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      data-slot="menubar-separator"
      {...props}
    />
  );
}

function MenubarShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/menubar-item:text-accent-foreground",
        className,
      )}
      data-slot="menubar-shortcut"
      {...props}
    />
  );
}

function MenubarSub({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />;
}

interface MenubarSubTriggerProps extends React.ComponentProps<typeof MenubarPrimitive.SubTrigger> {
  icon?: React.ReactNode;
  inset?: boolean;
  selected?: boolean;
}

function MenubarSubTrigger({
  "aria-current": ariaCurrent,
  children,
  className,
  disabled,
  icon,
  inset,
  selected = false,
  ...props
}: MenubarSubTriggerProps) {
  return (
    <MenubarPrimitive.SubTrigger
      aria-current={ariaCurrent ?? (selected ? "true" : undefined)}
      className={cn(
        "group/menubar-item relative flex min-w-48 cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-xs outline-none select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      data-inset={inset}
      data-selected={selected}
      data-slot="menubar-sub-trigger"
      disabled={disabled}
      {...props}
    >
      <MenubarItemLayout icon={icon} submenu>
        {children}
      </MenubarItemLayout>
    </MenubarPrimitive.SubTrigger>
  );
}

function MenubarSubContent({
  className,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.SubContent>) {
  return (
    <MenubarPrimitive.SubContent
      className={cn(
        "z-50 min-w-32 origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className,
      )}
      data-slot="menubar-sub-content"
      {...props}
    />
  );
}

export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarPortal,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
};
