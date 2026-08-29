import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
    } catch {
      // Clipboard permissions can be unavailable in a desktop webview.
    }
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("export.dialogs.optimized.arguments")}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={
                copied ? t("export.status.commandCopied") : t("export.actions.copyCommand")
              }
              disabled={!command}
              onClick={() => void copyCommand()}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {copied ? t("export.status.commandCopied") : t("export.actions.copyCommand")}
          </TooltipContent>
        </Tooltip>
      </div>
      <div
        aria-label={t("export.dialogs.optimized.arguments")}
        aria-readonly="true"
        className="max-h-40 min-h-28 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground"
        role="textbox"
      >
        {(error ?? command) || t("export.status.commandPreparing")}
      </div>
    </div>
  );
}
