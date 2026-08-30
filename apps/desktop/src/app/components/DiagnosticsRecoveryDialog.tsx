import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("app.dialogs.diagnosticsRecovery.title")}</DialogTitle>
          <DialogDescription>{t("app.dialogs.diagnosticsRecovery.description")}</DialogDescription>
        </DialogHeader>
        {revealFailed ? (
          <p className="text-sm text-destructive">
            {t("app.dialogs.diagnosticsRecovery.revealFailed")}
          </p>
        ) : null}
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">
            {t("common.actions.close")}
          </Button>
          <Button onClick={() => void showReport()}>
            {t("app.dialogs.diagnosticsRecovery.showReport")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
