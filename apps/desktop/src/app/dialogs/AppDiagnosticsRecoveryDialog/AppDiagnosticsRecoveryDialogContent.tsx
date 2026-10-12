import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AlertDialogScope } from "@/components/ui/alert-dialog";
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

function AppDiagnosticsRecoveryDialogContent({
  __scopeAlertDialog,
  recovery,
}: {
  __scopeAlertDialog?: AlertDialogScope;
  recovery: StartupRecovery;
}) {
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
        <AlertDialogTitle __scopeAlertDialog={__scopeAlertDialog}>
          {t("app.diagnosticsRecovery.confirmation.title")}
        </AlertDialogTitle>
        <AlertDialogDescription __scopeAlertDialog={__scopeAlertDialog}>
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
        <AlertDialogCancel __scopeAlertDialog={__scopeAlertDialog}>
          {t("common.actions.close")}
        </AlertDialogCancel>
        <AlertDialogAction
          __scopeAlertDialog={__scopeAlertDialog}
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
