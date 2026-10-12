import type { ReactNode } from "react";
import { Suspense } from "react";

import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

function SourceCloseDialog({
  children,
  onConfirm,
  sourceCount,
}: SourceCloseDialogContentProps & { children: ReactNode }) {
  return (
    <AlertDialog>
      {children}
      <AlertDialogContent>
        <Suspense fallback={null}>
          <LazySourceCloseDialogContent onConfirm={onConfirm} sourceCount={sourceCount} />
        </Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SourceCloseDialogTrigger({
  onFocus,
  onPointerEnter,
  ...props
}: React.ComponentProps<typeof AlertDialogTrigger>) {
  return (
    <AlertDialogTrigger
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
