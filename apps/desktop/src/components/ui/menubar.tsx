import { CheckIcon, ChevronRight } from "lucide-react";
import { Menubar as MenubarPrimitive } from "radix-ui";
import * as React from "react";

import {
  gateKeepOpenHandler,
  menuClassNames,
  MenuIcon,
  menuItemVariants,
} from "@/components/ui/menu";

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
        "flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium outline-hidden select-none hover:bg-muted aria-expanded:bg-muted",
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
          menuClassNames.content,
          "origin-(--radix-menubar-content-transform-origin)",
          className,
        )}
        data-slot="menubar-content"
        sideOffset={sideOffset}
        {...props}
      />
    </MenubarPortal>
  );
}

function MenubarItem({
  children,
  className,
  disabled,
  inset,
  keepOpen,
  onSelect,
  variant = "default",
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Item> & {
  inset?: boolean;
  keepOpen?: boolean;
  variant?: "default" | "destructive" | "success";
}) {
  return (
    <MenubarPrimitive.Item
      className={cn(menuItemVariants({ kind: "item", variant, className }))}
      data-inset={inset}
      data-slot="menubar-item"
      data-variant={variant}
      disabled={disabled}
      onSelect={gateKeepOpenHandler(keepOpen, onSelect)}
      {...props}
    >
      {children}
    </MenubarPrimitive.Item>
  );
}

function MenubarCheckboxItem({
  children,
  className,
  inset,
  keepOpen,
  onSelect,
  variant = "default",
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.CheckboxItem> & {
  inset?: boolean;
  keepOpen?: boolean;
  variant?: "default" | "destructive" | "success";
}) {
  return (
    <MenubarPrimitive.CheckboxItem
      className={cn(menuItemVariants({ kind: "checkbox", variant, className }))}
      data-inset={inset}
      data-slot="menubar-checkbox-item"
      onSelect={gateKeepOpenHandler(keepOpen, onSelect)}
      {...props}
    >
      <MenuIcon>
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon />
        </MenubarPrimitive.ItemIndicator>
      </MenuIcon>
      {children}
    </MenubarPrimitive.CheckboxItem>
  );
}

function MenubarRadioItem({
  children,
  className,
  inset,
  keepOpen,
  onSelect,
  variant = "default",
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioItem> & {
  inset?: boolean;
  keepOpen?: boolean;
  variant?: "default" | "destructive" | "success";
}) {
  return (
    <MenubarPrimitive.RadioItem
      className={cn(menuItemVariants({ kind: "radio", variant, className }))}
      data-inset={inset}
      data-slot="menubar-radio-item"
      onSelect={gateKeepOpenHandler(keepOpen, onSelect)}
      {...props}
    >
      <MenuIcon>
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon />
        </MenubarPrimitive.ItemIndicator>
      </MenuIcon>
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
      className={cn(menuClassNames.label, className)}
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
      className={cn(menuClassNames.separator, className)}
      data-slot="menubar-separator"
      {...props}
    />
  );
}

function MenubarShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(menuClassNames.shortcut, className)}
      data-slot="menubar-shortcut"
      {...props}
    />
  );
}

function MenubarSub({ ...props }: React.ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />;
}

interface MenubarSubTriggerProps extends React.ComponentProps<typeof MenubarPrimitive.SubTrigger> {
  inset?: boolean;
  keepOpen?: boolean;
}

function MenubarSubTrigger({
  children,
  className,
  disabled,
  inset,
  keepOpen,
  ...props
}: MenubarSubTriggerProps) {
  return (
    <MenubarPrimitive.SubTrigger
      className={cn(menuItemVariants({ kind: "subTrigger", className }))}
      data-inset={inset}
      data-keep-open={keepOpen || undefined}
      data-slot="menubar-sub-trigger"
      disabled={disabled}
      {...props}
    >
      {children}
      <MenuIcon side="right">
        <ChevronRight />
      </MenuIcon>
    </MenubarPrimitive.SubTrigger>
  );
}

function MenubarSubContent({
  alignOffset = -4,
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.SubContent>) {
  return (
    <MenubarPrimitive.SubContent
      alignOffset={alignOffset}
      className={cn(
        menuClassNames.content,
        "origin-(--radix-menubar-content-transform-origin)",
        className,
      )}
      data-slot="menubar-sub-content"
      sideOffset={sideOffset}
      {...props}
    />
  );
}

export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenuIcon as MenubarIcon,
  MenubarItem,
  menuItemVariants as menubarItemVariants,
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
