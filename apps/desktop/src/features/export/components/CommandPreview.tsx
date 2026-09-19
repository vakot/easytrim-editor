import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea, TextareaHeader, TextareaInput } from "@/components/ui/textarea";
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
      <Label htmlFor="ffmpeg-arguments">{t("export.dialogs.optimized.arguments")}</Label>

      <Textarea>
        <TextareaHeader className="justify-end">
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
        </TextareaHeader>

        <Separator />

        <TextareaInput
          className="max-h-48 min-h-30 font-mono text-muted-foreground"
          id="ffmpeg-arguments"
          readOnly
          value={(error ?? command) || t("export.status.commandPreparing")}
        />
      </Textarea>
    </div>
  );
}
