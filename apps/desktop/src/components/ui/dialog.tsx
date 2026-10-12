"use client";

import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/class-names.utils";

const createDialogScope = DialogPrimitive.createDialogScope;

type Scope = ReturnType<ReturnType<typeof createDialogScope>>;
type DialogScope = Scope["__scopeDialog"];
type ScopeProps = {
  __scopeDialog?: DialogScope;
};

type ScopedProps<T extends React.ElementType> = React.ComponentProps<T> & ScopeProps;
type ScopedComponentType<T extends React.ElementType> = React.ComponentType<ScopedProps<T>>;

const ScopedDialog = DialogPrimitive.Dialog as ScopedComponentType<typeof DialogPrimitive.Dialog>;

const ScopedDialogTrigger = DialogPrimitive.Trigger as ScopedComponentType<
  typeof DialogPrimitive.Trigger
>;

const ScopedDialogPortal = DialogPrimitive.Portal as ScopedComponentType<
  typeof DialogPrimitive.Portal
>;

const ScopedDialogOverlay = DialogPrimitive.Overlay as ScopedComponentType<
  typeof DialogPrimitive.Overlay
>;

const ScopedDialogContent = DialogPrimitive.Content as ScopedComponentType<
  typeof DialogPrimitive.Content
>;

const ScopedDialogClose = DialogPrimitive.Close as ScopedComponentType<
  typeof DialogPrimitive.Close
>;

const ScopedDialogTitle = DialogPrimitive.Title as ScopedComponentType<
  typeof DialogPrimitive.Title
>;

const ScopedDialogDescription = DialogPrimitive.Description as ScopedComponentType<
  typeof DialogPrimitive.Description
>;

function Dialog({ ...props }: React.ComponentProps<typeof ScopedDialog>) {
  return <ScopedDialog data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof ScopedDialogTrigger>) {
  return <ScopedDialogTrigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof ScopedDialogPortal>) {
  return <ScopedDialogPortal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof ScopedDialogClose>) {
  return <ScopedDialogClose data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof ScopedDialogOverlay>) {
  return (
    <ScopedDialogOverlay
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

function DialogContent({
  __scopeDialog,
  children,
  className,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof ScopedDialogContent> & {
  showCloseButton?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <ScopedDialogPortal __scopeDialog={__scopeDialog}>
      <DialogOverlay __scopeDialog={__scopeDialog} />
      <ScopedDialogContent
        __scopeDialog={__scopeDialog}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] min-w-0 -translate-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none *:min-w-0 sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        data-slot="dialog-content"
        {...props}
      >
        {children}
        {showCloseButton && (
          <ScopedDialogClose __scopeDialog={__scopeDialog} asChild data-slot="dialog-close">
            <Button className="absolute top-2 right-2" size="icon-sm" variant="ghost">
              <XIcon />
              <span className="sr-only">{t("common.actions.close")}</span>
            </Button>
          </ScopedDialogClose>
        )}
      </ScopedDialogContent>
    </ScopedDialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2 *:min-w-0", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({
  __scopeDialog,
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<"div"> &
  ScopeProps & {
    showCloseButton?: boolean;
  }) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className,
      )}
      data-slot="dialog-footer"
      {...props}
    >
      {showCloseButton && (
        <ScopedDialogClose __scopeDialog={__scopeDialog} asChild>
          <Button variant="outline">{t("common.actions.close")}</Button>
        </ScopedDialogClose>
      )}
      {children}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof ScopedDialogTitle>) {
  return (
    <ScopedDialogTitle
      className={cn(
        "min-w-0 font-heading text-base leading-none font-medium wrap-anywhere",
        className,
      )}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof ScopedDialogDescription>) {
  return (
    <ScopedDialogDescription
      className={cn(
        "min-w-0 text-sm wrap-anywhere text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      data-slot="dialog-description"
      {...props}
    />
  );
}

export {
  createDialogScope,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
export type { DialogScope };
