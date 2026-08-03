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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AppToolbarProps {
  session: SessionState;
  isChoosingSource: boolean;
  setExportQueue: Dispatch<SetStateAction<ExportToast[]>>;
  exportPresets: ExportPresetState;
  dispatchExportPreset: Dispatch<ExportPresetAction>;
  onChooseSource: () => void;
  onReturnToWelcome: () => void;
  onNativeDialogStateChange: (open: boolean) => void;
}

export function AppToolbar({
  session,
  isChoosingSource,
  setExportQueue,
  exportPresets,
  dispatchExportPreset,
  onChooseSource,
  onReturnToWelcome,
  onNativeDialogStateChange,
}: AppToolbarProps) {
  const { t } = useTranslation();

  return (
    <div
      className="grid h-[4.25rem] grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-background px-5"
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
            setQueue={setExportQueue}
            presetState={exportPresets}
            onPresetAction={dispatchExportPreset}
            onNativeDialogStateChange={onNativeDialogStateChange}
          />
        ) : null}
      </div>
    </div>
  );
}
