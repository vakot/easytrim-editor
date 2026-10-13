"use client";

import type { VariantProps } from "class-variance-authority";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import * as React from "react";

import { buttonVariants } from "@/components/ui/button";

import { cn } from "@/lib/class-names.utils";

const createAlertDialogScope = AlertDialogPrimitive.createAlertDialogScope;

type Scope = ReturnType<ReturnType<typeof createAlertDialogScope>>;
type AlertDialogScope = Scope["__scopeAlertDialog"];
type ScopeProps = {
  __scopeAlertDialog?: AlertDialogScope;
};

type ScopedProps<T extends React.ElementType> = React.ComponentProps<T> & ScopeProps;
type ScopedComponentType<T extends React.ElementType> = React.ComponentType<ScopedProps<T>>;

const ScopedAlertDialog = AlertDialogPrimitive.Root as ScopedComponentType<
  typeof AlertDialogPrimitive.Root
>;

const ScopedAlertDialogTrigger = AlertDialogPrimitive.Trigger as ScopedComponentType<
  typeof AlertDialogPrimitive.Trigger
>;

const ScopedAlertDialogPortal = AlertDialogPrimitive.Portal as ScopedComponentType<
  typeof AlertDialogPrimitive.Portal
>;

const ScopedAlertDialogOverlay = AlertDialogPrimitive.Overlay as ScopedComponentType<
  typeof AlertDialogPrimitive.Overlay
>;

const ScopedAlertDialogContent = AlertDialogPrimitive.Content as ScopedComponentType<
  typeof AlertDialogPrimitive.Content
>;

const ScopedAlertDialogTitle = AlertDialogPrimitive.Title as ScopedComponentType<
  typeof AlertDialogPrimitive.Title
>;

const ScopedAlertDialogDescription = AlertDialogPrimitive.Description as ScopedComponentType<
  typeof AlertDialogPrimitive.Description
>;

const ScopedAlertDialogAction = AlertDialogPrimitive.Action as ScopedComponentType<
  typeof AlertDialogPrimitive.Action
>;

const ScopedAlertDialogCancel = AlertDialogPrimitive.Cancel as ScopedComponentType<
  typeof AlertDialogPrimitive.Cancel
>;

function AlertDialog({ ...props }: React.ComponentProps<typeof ScopedAlertDialog>) {
  return <ScopedAlertDialog data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({ ...props }: React.ComponentProps<typeof ScopedAlertDialogTrigger>) {
  return <ScopedAlertDialogTrigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal({ ...props }: React.ComponentProps<typeof ScopedAlertDialogPortal>) {
  return <ScopedAlertDialogPortal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay({
  __scopeAlertDialog,
  className,
  ...props
}: React.ComponentProps<typeof ScopedAlertDialogOverlay>) {
  return (
    <ScopedAlertDialogOverlay
      __scopeAlertDialog={__scopeAlertDialog}
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      data-slot="alert-dialog-overlay"
      {...props}
    />
  );
}

function AlertDialogContent({
  __scopeAlertDialog,
  className,
  ...props
}: React.ComponentProps<typeof ScopedAlertDialogContent>) {
  return (
    <AlertDialogPortal __scopeAlertDialog={__scopeAlertDialog}>
      <AlertDialogOverlay __scopeAlertDialog={__scopeAlertDialog} />
      <ScopedAlertDialogContent
        __scopeAlertDialog={__scopeAlertDialog}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] min-w-0 -translate-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none *:min-w-0 sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        data-slot="alert-dialog-content"
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2 *:min-w-0", className)}
      data-slot="alert-dialog-header"
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className,
      )}
      data-slot="alert-dialog-footer"
      {...props}
    />
  );
}

function AlertDialogTitle({
  __scopeAlertDialog,
  className,
  ...props
}: React.ComponentProps<typeof ScopedAlertDialogTitle>) {
  return (
    <ScopedAlertDialogTitle
      __scopeAlertDialog={__scopeAlertDialog}
      className={cn(
        "min-w-0 font-heading text-base leading-none font-medium wrap-anywhere",
        className,
      )}
      data-slot="alert-dialog-title"
      {...props}
    />
  );
}

function AlertDialogDescription({
  __scopeAlertDialog,
  className,
  ...props
}: React.ComponentProps<typeof ScopedAlertDialogDescription>) {
  return (
    <ScopedAlertDialogDescription
      __scopeAlertDialog={__scopeAlertDialog}
      className={cn(
        "min-w-0 text-sm wrap-anywhere text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      data-slot="alert-dialog-description"
      {...props}
    />
  );
}

function AlertDialogAction({
  __scopeAlertDialog,
  className,
  size,
  variant,
  ...props
}: React.ComponentProps<typeof ScopedAlertDialogAction> &
  Pick<VariantProps<typeof buttonVariants>, "size" | "variant">) {
  return (
    <ScopedAlertDialogAction
      __scopeAlertDialog={__scopeAlertDialog}
      className={cn(buttonVariants({ size, variant }), className)}
      data-slot="alert-dialog-action"
      {...props}
    />
  );
}

function AlertDialogCancel({
  __scopeAlertDialog,
  className,
  size,
  ...props
}: React.ComponentProps<typeof ScopedAlertDialogCancel> &
  Pick<VariantProps<typeof buttonVariants>, "size">) {
  return (
    <ScopedAlertDialogCancel
      __scopeAlertDialog={__scopeAlertDialog}
      autoFocus
      className={cn(buttonVariants({ size, variant: "outline" }), className)}
      data-slot="alert-dialog-cancel"
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
  createAlertDialogScope,
};
export type { AlertDialogScope };
