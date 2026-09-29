import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ContextMenuCheckboxItem, ContextMenuItem } from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type AudioTrackState } from "@/app/store/slices/audio-slice";
import type { AudioTrackController } from "../../../hooks/useAudioTrackController";
import type { AudioTrackProcessing, LoudnessPreset } from "@/domain/audio-processing";
import type { AudioStream } from "@/lib/tauri/media.types";

type MenuMode = "context" | "dropdown";

interface AudioTrackActionsProps {
  controller: AudioTrackController;
  mode?: MenuMode;
  stream: AudioStream;
  trackNumber: number;
}

function AudioTrackActions({
  controller,
  mode = "dropdown",
  stream,
  trackNumber,
}: AudioTrackActionsProps) {
  const { t } = useTranslation();
  const track = controller.track;
  if (!track) return null;

  const content = (
    <AudioTrackActionContent
      activityAnalysis={track.activityAnalysis}
      activityVisible={track.activityVisible}
      gainDb={track.processing.gainDb}
      loudnessAnalysis={track.loudnessAnalysis}
      mode={mode}
      normalization={track.processing.loudnessNormalization}
      onAnalyzeLoudness={controller.analyzeLoudness}
      onDetectActivity={controller.detectActivity}
      onGainChange={controller.setGain}
      onNormalizationChange={controller.setNormalization}
      onToggleActivity={controller.toggleActivityVisibility}
      onToggleEnabled={controller.setEnabled}
      streamTitle={stream.title ?? t("audio.labels.defaultTrack", { number: trackNumber })}
      track={track}
    />
  );

  if (mode === "context") return content;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("audio.accessibility.trackActions", { number: trackNumber })}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <MoreVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{content}</DropdownMenuContent>
    </DropdownMenu>
  );
}

interface AudioTrackActionContentProps {
  activityAnalysis: AudioTrackState["activityAnalysis"];
  activityVisible: boolean;
  gainDb: number;
  loudnessAnalysis: AudioTrackState["loudnessAnalysis"];
  mode: MenuMode;
  normalization: AudioTrackProcessing["loudnessNormalization"];
  onAnalyzeLoudness: () => void;
  onDetectActivity: () => void;
  onGainChange: (gainDb: number) => void;
  onNormalizationChange: (preset: LoudnessPreset | null) => void;
  onToggleActivity: () => void;
  onToggleEnabled: () => void;
  streamTitle: string;
  track: AudioTrackState;
}

function AudioTrackActionContent({
  activityAnalysis,
  activityVisible,
  gainDb,
  loudnessAnalysis,
  mode,
  normalization,
  onAnalyzeLoudness,
  onDetectActivity,
  onGainChange,
  onNormalizationChange,
  onToggleActivity,
  onToggleEnabled,
  streamTitle,
  track,
}: AudioTrackActionContentProps) {
  const { t } = useTranslation();
  const isAnalyzingLoudness = loudnessAnalysis.status === "loading";
  const isDetectingActivity = activityAnalysis.status === "loading";
  const activityDetected = activityAnalysis.status === "ready";
  const enabledLabel = track.enabled
    ? t("audio.actions.muteTrack", { title: streamTitle })
    : t("audio.actions.unmuteTrack", { title: streamTitle });

  const loudnessActionLabel = isAnalyzingLoudness
    ? t("audio.actions.analyzingLoudness")
    : loudnessAnalysis.status === "ready"
      ? t("audio.actions.reanalyzeLoudness")
      : t("audio.actions.analyzeLoudness");

  const activityActionLabel = isDetectingActivity
    ? t("audio.actions.detectingActivity")
    : activityAnalysis.status === "failed"
      ? t("audio.actions.retryActivityDetection")
      : t("audio.actions.detectActivity");

  const activityVisibilityLabel = activityVisible
    ? t("audio.actions.hideActivity")
    : t("audio.actions.showActivity");

  return (
    <div className="grid min-w-64 gap-2 p-2" data-slot="audio-track-actions">
      <TrackMenuItem
        checked={track.enabled}
        label={enabledLabel}
        mode={mode}
        onAction={onToggleEnabled}
      />

      <div className="grid gap-1.5 rounded-md border border-border/60 p-2">
        <Label htmlFor={`track-gain-${track.streamIndex}`}>{t("audio.labels.trackGain")}</Label>
        <div className="flex items-center gap-2">
          <Input
            aria-label={t("audio.accessibility.trackGain", { title: streamTitle })}
            id={`track-gain-${track.streamIndex}`}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value)) onGainChange(value);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            step="any"
            type="number"
            value={gainDb}
          />
          <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">
            dB
          </span>
          <Button
            aria-label={t("audio.actions.resetTrackGain")}
            className="shrink-0"
            disabled={gainDb === 0}
            onClick={(event) => {
              event.stopPropagation();
              onGainChange(0);
            }}
            size="xs"
            type="button"
            variant="outline"
          >
            {t("audio.actions.resetGain")}
          </Button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`track-normalization-${track.streamIndex}`}>
          {t("audio.labels.loudnessNormalization")}
        </Label>
        <select
          aria-label={t("audio.accessibility.trackNormalization", { title: streamTitle })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          id={`track-normalization-${track.streamIndex}`}
          onChange={(event) =>
            onNormalizationChange(
              event.currentTarget.value === "none"
                ? null
                : (event.currentTarget.value as LoudnessPreset),
            )
          }
          onPointerDown={(event) => event.stopPropagation()}
          value={normalization ?? "none"}
        >
          <option value="none">{t("audio.options.normalizationNone")}</option>
          <option value="webVideo">
            {t("export.dialogs.optimized.loudness.presets.webVideo")}
          </option>
          <option value="streaming">
            {t("export.dialogs.optimized.loudness.presets.streaming")}
          </option>
          <option value="broadcast">
            {t("export.dialogs.optimized.loudness.presets.broadcast")}
          </option>
        </select>
      </div>

      <TrackMenuItem
        disabled={isAnalyzingLoudness}
        label={loudnessActionLabel}
        mode={mode}
        onAction={onAnalyzeLoudness}
      />
      {loudnessAnalysis.status === "ready" ? (
        <p className="px-2 text-xs text-muted-foreground" role="status">
          {formatLoudness(loudnessAnalysis.value)}
        </p>
      ) : null}
      {loudnessAnalysis.status === "failed" ? (
        <p className="px-2 text-xs text-destructive" role="alert">
          {loudnessAnalysis.error.message}
        </p>
      ) : null}

      <TrackMenuItem
        disabled={isDetectingActivity}
        label={activityActionLabel}
        mode={mode}
        onAction={onDetectActivity}
      />
      {activityDetected ? (
        <>
          <TrackMenuItem
            checked={activityVisible}
            label={activityVisibilityLabel}
            mode={mode}
            onAction={onToggleActivity}
          />
          <p className="px-2 text-xs text-muted-foreground" role="status">
            {t("audio.messages.activityRanges")}
          </p>
        </>
      ) : null}
      {activityAnalysis.status === "failed" ? (
        <p className="px-2 text-xs text-destructive" role="alert">
          {activityAnalysis.error.message}
        </p>
      ) : null}
      {track.preview.status === "loading" ? (
        <p className="px-2 text-xs text-muted-foreground" role="status">
          {t("audio.messages.preparingProcessedPreview")}
        </p>
      ) : null}
      {track.preview.status === "failed" ? (
        <p className="px-2 text-xs text-destructive" role="alert">
          {track.preview.error.message}
        </p>
      ) : null}
    </div>
  );
}

function TrackMenuItem({
  checked,
  disabled,
  label,
  mode,
  onAction,
}: {
  checked?: boolean;
  disabled?: boolean;
  label: string;
  mode: MenuMode;
  onAction: () => void;
}) {
  if (mode === "context") {
    return checked === undefined ? (
      <ContextMenuItem disabled={disabled} keepOpen onSelect={onAction}>
        {label}
      </ContextMenuItem>
    ) : (
      <ContextMenuCheckboxItem checked={checked} disabled={disabled} onCheckedChange={onAction}>
        {label}
      </ContextMenuCheckboxItem>
    );
  }
  return checked === undefined ? (
    <DropdownMenuItem disabled={disabled} keepOpen onSelect={onAction}>
      {label}
    </DropdownMenuItem>
  ) : (
    <DropdownMenuCheckboxItem
      checked={checked}
      disabled={disabled}
      keepOpen
      onCheckedChange={onAction}
    >
      {label}
    </DropdownMenuCheckboxItem>
  );
}

function formatLoudness(analysis: { integratedLufs?: number; truePeakDb?: number }): string {
  const loudness =
    analysis.integratedLufs === undefined ? "—" : `${analysis.integratedLufs.toFixed(1)} LUFS`;

  const peak = analysis.truePeakDb === undefined ? "—" : `${analysis.truePeakDb.toFixed(1)} dBTP`;
  return `${loudness} · ${peak}`;
}

export { AudioTrackActions };
