import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SessionState } from "@/app/session-state";
import { CapabilityStatus } from "@/features/import-source/SourceWorkspace";
import { ExportPanel, type ExportToast } from "@/features/export";
import type { ExportPresetAction, ExportPresetState } from "@/features/export/export-presets";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./LanguageSelector";
import { ThemeSelector } from "./ThemeSelector";
import { PrimaryColorSelector } from "./PrimaryColorSelector";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AppToolbarProps {
  session: SessionState;
  isChoosingSource: boolean;
  isChoosingWebcam: boolean;
  setExportQueue: Dispatch<SetStateAction<ExportToast[]>>;
  exportPresets: ExportPresetState;
  dispatchExportPreset: Dispatch<ExportPresetAction>;
  onChooseSource: () => void;
  onChooseWebcam: () => void;
  onReturnToWelcome: () => void;
  onNativeDialogStateChange: (open: boolean) => void;
  cropResolution: { width: number; height: number };
  crop?: { x: number; y: number; width: number; height: number };
}

export function AppToolbar({
  session,
  isChoosingSource,
  isChoosingWebcam,
  setExportQueue,
  exportPresets,
  dispatchExportPreset,
  onChooseSource,
  onChooseWebcam,
  onReturnToWelcome,
  onNativeDialogStateChange,
  cropResolution,
  crop,
}: AppToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-background">
      <div
        className="grid h-[4.25rem] grid-cols-[1fr_auto_1fr] items-center px-5"
        role="toolbar"
        aria-label={t("app.toolbar")}
      >
        <button
          className="w-fit whitespace-nowrap font-heading text-4xl font-black tracking-[0.08em] text-primary outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          aria-label={t("app.returnToWelcome")}
          onClick={onReturnToWelcome}
        >
          {t("common.shortBrand")}
        </button>
        <CapabilityStatus capabilities={session.capabilities} />
        <div className="flex items-center justify-end gap-3 pl-4">
          <PrimaryColorSelector />
          <ThemeSelector />
          <LanguageSelector className="w-36" />
          <Separator orientation="vertical" className="h-auto self-stretch" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={onChooseSource}
                disabled={isChoosingSource}
                aria-keyshortcuts="Control+O"
              >
                {isChoosingSource ? t("import.opening") : t("import.openVideo")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("import.openTooltip")}</TooltipContent>
          </Tooltip>
          {session.status === "ready" && session.source ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={onChooseWebcam} disabled={isChoosingWebcam}>
                  {isChoosingWebcam
                    ? t("webcam.adding")
                    : t(session.source.webcam ? "webcam.replace" : "webcam.add")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("webcam.addTooltip")}</TooltipContent>
            </Tooltip>
          ) : null}
          {session.status === "ready" && session.source?.media && session.source.trim ? (
            <ExportPanel
              key={`export-${session.source.selection.sourceId}`}
              source={session.source.media}
              sourceName={session.source.selection.displayName}
              trim={session.source.trim}
              audioTracks={session.source.audioTracks}
              masterEnabled={session.source.masterEnabled}
              masterVolumePercent={session.source.masterVolumePercent}
              mergeAudio={session.source.mergeAudio}
              webcam={session.source.webcam}
              setQueue={setExportQueue}
              presetState={exportPresets}
              onPresetAction={dispatchExportPreset}
              onNativeDialogStateChange={onNativeDialogStateChange}
              cropResolution={cropResolution}
              crop={crop}
            />
          ) : null}
        </div>
      </div>
      <Separator />
    </div>
  );
}
