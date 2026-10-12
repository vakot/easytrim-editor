import { Suspense, useEffect, useState } from "react";

import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";

import { diagnostics } from "@/lib/diagnostics";
import { lazyWithPreload } from "@/lib/lazy-component";
import type { StartupRecovery } from "@/lib/tauri/diagnostics.types";

const LazyAppDiagnosticsRecoveryDialogContent = lazyWithPreload<{
  recovery: StartupRecovery;
}>(() =>
  import("./AppDiagnosticsRecoveryDialogContent").then((module) => ({
    default: module.AppDiagnosticsRecoveryDialogContent,
  })),
);

function AppDiagnosticsRecoveryDialog({
  recovery = diagnostics.getStartupRecovery(),
}: {
  recovery?: StartupRecovery | null;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!recovery) return;

    let active = true;
    void LazyAppDiagnosticsRecoveryDialogContent.preload().then(
      () => {
        if (active) setOpen(true);
      },
      () => {
        if (active) setOpen(true);
      },
    );

    return () => {
      active = false;
    };
  }, [recovery]);

  if (!recovery) return null;

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogContent>
        <Suspense fallback={null}>
          <LazyAppDiagnosticsRecoveryDialogContent recovery={recovery} />
        </Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { AppDiagnosticsRecoveryDialog };
