import type { ReactNode } from "react";
import { Suspense } from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTrigger,
  createAlertDialogScope,
} from "@/components/ui/alert-dialog";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import type { SourceCloseDialogContentProps } from "./SourceCloseDialogContent";

const LazySourceCloseDialogContent = lazyWithPreload<SourceCloseDialogContentProps>(() =>
  import("./SourceCloseDialogContent").then((module) => ({
    default: module.SourceCloseDialogContent,
  })),
);

const preloadSourceCloseDialogContent = preloadOnIntent(() =>
  LazySourceCloseDialogContent.preload(),
);

const useSourceCloseDialogScope = createAlertDialogScope();

function SourceCloseDialog({
  __scopeAlertDialog,
  children,
  onConfirm,
  sourceCount,
}: SourceCloseDialogContentProps & {
  children: ReactNode;
}) {
  const alertDialogScope = useSourceCloseDialogScope(__scopeAlertDialog);
  return (
    <AlertDialog {...alertDialogScope}>
      {children}
      <AlertDialogContent {...alertDialogScope}>
        <Suspense fallback={null}>
          <LazySourceCloseDialogContent
            __scopeAlertDialog={alertDialogScope.__scopeAlertDialog}
            onConfirm={onConfirm}
            sourceCount={sourceCount}
          />
        </Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SourceCloseDialogTrigger({
  __scopeAlertDialog,
  onFocus,
  onPointerEnter,
  ...props
}: React.ComponentProps<typeof AlertDialogTrigger>) {
  const alertDialogScope = useSourceCloseDialogScope(__scopeAlertDialog);
  return (
    <AlertDialogTrigger
      {...alertDialogScope}
      onFocus={(event) => {
        onFocus?.(event);
        preloadSourceCloseDialogContent();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        preloadSourceCloseDialogContent();
      }}
      {...props}
    />
  );
}

export { SourceCloseDialog, SourceCloseDialogTrigger };
