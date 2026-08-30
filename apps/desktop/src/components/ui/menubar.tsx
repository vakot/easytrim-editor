import { cva } from "class-variance-authority";
import { CheckIcon, ChevronRight } from "lucide-react";
import { Menubar as MenubarPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/class-names.utils";

const menubarItemVariants = cva(
  "group/menubar-item relative flex h-6 min-w-36 cursor-default items-center gap-8 rounded-md px-1.5 py-1 text-xs outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:px-7 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      kind: {
        item: "",
        checkbox: "pl-7",
        radio: "pl-7",
        subTrigger: "data-open:bg-accent data-open:text-accent-foreground",
      },
      variant: {
        default: "",
        success:
          "text-success focus:bg-success/10 focus:text-success dark:focus:bg-success/20 [&_svg]:text-success!",
        destructive:
          "text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20 [&_svg]:text-destructive!",
      },
    },
    defaultVariants: {
      variant: "default",
      kind: "item",
    },
  },
);

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
      className={cn(menubarItemVariants({ kind: "item", variant, className }))}
      data-inset={inset}
      data-slot="menubar-item"
      data-variant={variant}
      disabled={disabled}
      onSelect={(event) => {
        if (keepOpen) event.preventDefault();
        onSelect?.(event);
      }}
      {...props}
    >
      {children}
    </MenubarPrimitive.Item>
  );
}

function MenubarCheckboxItem({
  checked,
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
      checked={checked}
      className={cn(menubarItemVariants({ kind: "checkbox", variant, className }))}
      data-inset={inset}
      data-slot="menubar-checkbox-item"
      onSelect={(event) => {
        if (keepOpen) event.preventDefault();
        onSelect?.(event);
      }}
      {...props}
    >
      <MenubarIcon>
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon />
        </MenubarPrimitive.ItemIndicator>
      </MenubarIcon>
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
      className={cn(menubarItemVariants({ kind: "radio", variant, className }))}
      data-inset={inset}
      data-slot="menubar-radio-item"
      onSelect={(event) => {
        if (keepOpen) event.preventDefault();
        onSelect?.(event);
      }}
      {...props}
    >
      <MenubarIcon>
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon />
        </MenubarPrimitive.ItemIndicator>
      </MenubarIcon>
      {children}
    </MenubarPrimitive.RadioItem>
  );
}

function MenubarIcon({
  children,
  className,
  side = "left",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { side?: "left" | "right" }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute flex size-3 items-center justify-center text-muted-foreground [&_svg:not([class*='size-'])]:size-3",
        side === "left" ? "left-1.5" : "right-1.5",
        className,
      )}
      {...props}
    >
      {children}
    </span>
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
      className={cn("px-1.5 py-1 text-xs font-medium data-inset:px-7", className)}
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
      className={cn(menubarItemVariants({ kind: "subTrigger", className }))}
      data-inset={inset}
      data-keep-open={keepOpen || undefined}
      data-slot="menubar-sub-trigger"
      disabled={disabled}
      {...props}
    >
      {children}
      <MenubarIcon side="right">
        <ChevronRight />
      </MenubarIcon>
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
        "z-50 min-w-32 origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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
  MenubarIcon,
  MenubarItem,
  menubarItemVariants,
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
