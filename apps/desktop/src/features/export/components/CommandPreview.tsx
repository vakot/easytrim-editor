import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface CommandPreviewProps {
  command: string;
  error?: string | null;
}

export function CommandPreview({ command, error }: CommandPreviewProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    if (!command || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permissions can be unavailable in a desktop webview.
    }
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("export.dialog.arguments")}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={t("export.dialog.copyCommand", "Copy command")}
          aria-label={t("export.dialog.copyCommand", "Copy command")}
          disabled={!command}
          onClick={() => void copyCommand()}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <div
        className="max-h-40 min-h-28 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground"
        role="textbox"
        aria-readonly="true"
        aria-label={t("export.dialog.arguments")}
      >
        {(error ?? command) || t("export.dialog.commandPreparing", "Preparing command preview…")}
      </div>
    </div>
  );
}
