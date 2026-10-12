import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { diagnostics } from "@/lib/diagnostics";
import { revealDiagnosticReport } from "@/lib/tauri/diagnostics";
import type { StartupRecovery } from "@/lib/tauri/diagnostics.types";

function AppDiagnosticsRecoveryDialogContent({ recovery }: { recovery: StartupRecovery }) {
  const [revealFailed, setRevealFailed] = useState(false);
  const { t } = useTranslation();

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
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("app.diagnosticsRecovery.confirmation.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("app.diagnosticsRecovery.confirmation.description")}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {revealFailed ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t("app.diagnosticsRecovery.confirmation.revealFailed")}
          </AlertDescription>
        </Alert>
      ) : null}

      <AlertDialogFooter>
        <AlertDialogCancel>{t("common.actions.close")}</AlertDialogCancel>
        <AlertDialogAction
          onClick={(event) => {
            event.preventDefault();
            void showReport();
          }}
        >
          {t("app.diagnosticsRecovery.confirmation.showReport")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { AppDiagnosticsRecoveryDialogContent };
