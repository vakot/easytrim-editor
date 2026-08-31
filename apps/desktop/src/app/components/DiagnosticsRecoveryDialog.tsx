import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { diagnostics } from "@/lib/diagnostics";
import { revealDiagnosticReport } from "@/lib/tauri/diagnostics";
import type { StartupRecovery } from "@/lib/tauri/diagnostics.types";

interface DiagnosticsRecoveryDialogProps {
  recovery?: StartupRecovery | null;
}

export function DiagnosticsRecoveryDialog({
  recovery = diagnostics.getStartupRecovery(),
}: DiagnosticsRecoveryDialogProps) {
  const [open, setOpen] = useState(recovery !== null);
  const [revealFailed, setRevealFailed] = useState(false);
  const { t } = useTranslation();

  if (!recovery) return null;

  const showReport = async () => {
    setRevealFailed(false);
    try {
      await revealDiagnosticReport(recovery);
    } catch (error: unknown) {
      setRevealFailed(true);
      diagnostics.error("diagnostics.report.reveal-failed", error, {
        data: { reportId: recovery.reportId },
        origin: { id: "startup-recovery.show-report", type: "button" },
      });
    }
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("app.dialogs.diagnosticsRecovery.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("app.dialogs.diagnosticsRecovery.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {revealFailed ? (
          <p className="text-sm text-destructive">
            {t("app.dialogs.diagnosticsRecovery.revealFailed")}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.actions.close")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void showReport();
            }}
          >
            {t("app.dialogs.diagnosticsRecovery.showReport")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
