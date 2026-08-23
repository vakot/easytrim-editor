import { PanelBottom, PanelLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorViewState } from "@/app/hooks/useEditorViewState";

interface PanelVisibilityControlsProps {
  hasAudioTracks: boolean;
}

export function PanelVisibilityControls({ hasAudioTracks }: PanelVisibilityControlsProps) {
  const { t } = useTranslation();
  const { showSourceDetails, setShowSourceDetails, showAudioTracks, setShowAudioTracks } =
    useEditorViewState();

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t("app.panels.group")}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              showSourceDetails
                ? t("app.panels.hideSourceDetails")
                : t("app.panels.showSourceDetails")
            }
            aria-pressed={showSourceDetails}
            data-state={showSourceDetails ? "on" : "off"}
            className={showSourceDetails ? "text-primary" : undefined}
            onClick={() => setShowSourceDetails(!showSourceDetails)}
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {showSourceDetails
            ? t("app.panels.hideSourceDetails")
            : t("app.panels.showSourceDetails")}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!hasAudioTracks}
            aria-label={
              showAudioTracks ? t("app.panels.hideAudioTracks") : t("app.panels.showAudioTracks")
            }
            aria-pressed={showAudioTracks}
            data-state={showAudioTracks ? "on" : "off"}
            className={showAudioTracks ? "text-primary" : undefined}
            onClick={() => setShowAudioTracks(!showAudioTracks)}
          >
            <PanelBottom className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {showAudioTracks ? t("app.panels.hideAudioTracks") : t("app.panels.showAudioTracks")}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
