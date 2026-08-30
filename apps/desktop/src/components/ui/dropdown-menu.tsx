import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import * as React from "react";

import {
  gateKeepOpenHandler,
  gateKeepOpenHandlers,
  menuContentClassName,
  MenuIcon,
  menuItemVariants,
  menuLabelClassName,
  menuSeparatorClassName,
  menuShortcutClassName,
  menuSubContentClassName,
} from "@/components/ui/menu";

import { cn } from "@/lib/class-names.utils";

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  align = "start",
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        className={cn(
          menuContentClassName,
          "origin-(--radix-dropdown-menu-content-transform-origin)",
          className,
        )}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
  className,
  disabled,
  inset,
  keepOpen,
  onSelect,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  keepOpen?: boolean;
  variant?: "default" | "destructive" | "success";
}) {
  const gatedProps = gateKeepOpenHandlers(props, keepOpen, onSelect !== undefined);

  return (
    <DropdownMenuPrimitive.Item
      className={cn(menuItemVariants({ kind: "item", variant, className }))}
      data-inset={inset}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      disabled={disabled}
      onSelect={gateKeepOpenHandler(keepOpen, onSelect)}
      {...gatedProps}
    />
  );
}

function DropdownMenuCheckboxItem({
  checked,
  children,
  className,
  disabled,
  inset,
  keepOpen,
  onSelect,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  inset?: boolean;
  keepOpen?: boolean;
  variant?: "default" | "destructive" | "success";
}) {
  const gatedProps = gateKeepOpenHandlers(props, keepOpen, onSelect !== undefined);

  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(menuItemVariants({ kind: "checkbox", variant, className }))}
      data-inset={inset}
      data-slot="dropdown-menu-checkbox-item"
      data-variant={variant}
      disabled={disabled}
      onSelect={gateKeepOpenHandler(keepOpen, onSelect)}
      {...gatedProps}
    >
      <MenuIcon>
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon />
        </DropdownMenuPrimitive.ItemIndicator>
      </MenuIcon>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  children,
  className,
  disabled,
  inset,
  keepOpen,
  onSelect,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  inset?: boolean;
  keepOpen?: boolean;
  variant?: "default" | "destructive" | "success";
}) {
  const gatedProps = gateKeepOpenHandlers(props, keepOpen, onSelect !== undefined);

  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(menuItemVariants({ kind: "radio", variant, className }))}
      data-inset={inset}
      data-slot="dropdown-menu-radio-item"
      data-variant={variant}
      disabled={disabled}
      onSelect={gateKeepOpenHandler(keepOpen, onSelect)}
      {...gatedProps}
    >
      <MenuIcon>
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon />
        </DropdownMenuPrimitive.ItemIndicator>
      </MenuIcon>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(menuLabelClassName, className)}
      data-inset={inset}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn(menuSeparatorClassName, className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(menuShortcutClassName, className)}
      data-slot="dropdown-menu-shortcut"
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  children,
  className,
  disabled,
  inset,
  keepOpen,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
  keepOpen?: boolean;
}) {
  const gatedProps = gateKeepOpenHandlers(props, keepOpen, false);

  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(menuItemVariants({ kind: "subTrigger", className }))}
      data-inset={inset}
      data-keep-open={keepOpen || undefined}
      data-slot="dropdown-menu-sub-trigger"
      disabled={disabled}
      {...gatedProps}
    >
      {children}
      <MenuIcon side="right">
        <ChevronRightIcon />
      </MenuIcon>
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      className={cn(
        menuSubContentClassName,
        "origin-(--radix-dropdown-menu-content-transform-origin)",
        className,
      )}
      data-slot="dropdown-menu-sub-content"
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  menuItemVariants as dropdownMenuItemVariants,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
