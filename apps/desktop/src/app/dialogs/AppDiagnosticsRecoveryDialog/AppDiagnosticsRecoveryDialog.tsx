import { Suspense, useEffect, useState } from "react";

import type { AlertDialogScope } from "@/components/ui/alert-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  createAlertDialogScope,
} from "@/components/ui/alert-dialog";

import { diagnostics } from "@/lib/diagnostics";
import { lazyWithPreload } from "@/lib/lazy-component";
import type { StartupRecovery } from "@/lib/tauri/diagnostics.types";

const useAppDiagnosticsRecoveryDialogScope = createAlertDialogScope();

const LazyAppDiagnosticsRecoveryDialogContent = lazyWithPreload<{
  __scopeAlertDialog?: AlertDialogScope;
  recovery: StartupRecovery;
}>(() =>
  import("./AppDiagnosticsRecoveryDialogContent").then((module) => ({
    default: module.AppDiagnosticsRecoveryDialogContent,
  })),
);

function AppDiagnosticsRecoveryDialog({
  __scopeAlertDialog,
  recovery = diagnostics.getStartupRecovery(),
}: {
  __scopeAlertDialog?: AlertDialogScope;
  recovery?: StartupRecovery | null;
}) {
  const alertDialogScope = useAppDiagnosticsRecoveryDialogScope(__scopeAlertDialog);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!recovery) return;

    let active = true;
    const openAfterPreload = () => {
      if (active) setOpen(true);
    };

    void LazyAppDiagnosticsRecoveryDialogContent.preload().then(openAfterPreload, openAfterPreload);

    return () => {
      active = false;
    };
  }, [recovery]);

  if (!recovery) return null;

  return (
    <AlertDialog {...alertDialogScope} onOpenChange={setOpen} open={open}>
      <AlertDialogContent {...alertDialogScope}>
        <Suspense fallback={null}>
          <LazyAppDiagnosticsRecoveryDialogContent
            __scopeAlertDialog={alertDialogScope.__scopeAlertDialog}
            recovery={recovery}
          />
        </Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { AppDiagnosticsRecoveryDialog };
