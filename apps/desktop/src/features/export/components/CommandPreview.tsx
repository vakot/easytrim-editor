import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
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
      <InputGroup>
        <InputGroupTextarea
          aria-labelledby="ffmpeg-arguments-label"
          className="max-h-48 min-h-30 font-mono text-muted-foreground"
          id="ffmpeg-arguments"
          readOnly
          value={(error ?? command) || t("export.status.commandPreparing")}
        />
        <InputGroupAddon align="block-start" className="border-b">
          <InputGroupText className="font-medium" id="ffmpeg-arguments-label">
            {t("export.dialogs.optimized.arguments")}
          </InputGroupText>
          <Tooltip>
            <TooltipTrigger asChild>
              <InputGroupButton
                aria-label={
                  copied ? t("export.status.commandCopied") : t("export.actions.copyCommand")
                }
                className="ml-auto"
                disabled={!command}
                onClick={() => void copyCommand()}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                {copied ? <Check /> : <Copy />}
              </InputGroupButton>
            </TooltipTrigger>
            <TooltipContent>
              {copied ? t("export.status.commandCopied") : t("export.actions.copyCommand")}
            </TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
