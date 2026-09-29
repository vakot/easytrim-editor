import { createContext, type ReactNode, useContext, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import {
  type AudioTrackProcessing,
  cloneAudioTrackProcessing,
  type CustomLoudnessNormalization,
  DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION,
  sameAudioTrackProcessing,
} from "@/domain/audio-processing";

import type { AudioTrackController } from "../../../hooks/useAudioTrackController";

interface AudioTrackEffectsDialogProps {
  children: ReactNode;
  controller: AudioTrackController;
  title: string;
  track: AudioTrackState;
}

type NormalizationOption = "none" | "webVideo" | "streaming" | "broadcast" | "custom";

function AudioTrackEffectsDialog({
  children,
  controller,
  title,
  track,
}: AudioTrackEffectsDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => cloneAudioTrackProcessing(track.processing));
  const [targetLufsDraft, setTargetLufsDraft] = useState(
    String(DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION.targetLufs),
  );

  const [maxTruePeakDraft, setMaxTruePeakDraft] = useState(
    String(DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION.maxTruePeakDb),
  );

  const normalization = draft.loudnessNormalization;
  const customNormalization =
    typeof normalization === "object" && normalization.mode === "custom" ? normalization : null;

  const isDirty = !sameAudioTrackProcessing(track.processing, draft);
  const hasValidCustomNormalization =
    customNormalization === null ||
    (isInRange(targetLufsDraft, -36, -5) && isInRange(maxTruePeakDraft, -9, 0));

  const openEffects = () => {
    const processing = cloneAudioTrackProcessing(track.processing);
    setDraft(processing);
    const custom = processing.loudnessNormalization;
    if (typeof custom === "object" && custom.mode === "custom") {
      setTargetLufsDraft(String(custom.targetLufs));
      setMaxTruePeakDraft(String(custom.maxTruePeakDb));
    } else {
      setTargetLufsDraft(String(DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION.targetLufs));
      setMaxTruePeakDraft(String(DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION.maxTruePeakDb));
    }
    setOpen(true);
  };

  const changeNormalization = (value: NormalizationOption) => {
    if (value === "custom") {
      const current = draft.loudnessNormalization;
      const custom =
        typeof current === "object" && current.mode === "custom"
          ? current
          : DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION;

      setTargetLufsDraft(String(custom.targetLufs));
      setMaxTruePeakDraft(String(custom.maxTruePeakDb));
    }

    setDraft((current) => {
      const next = cloneAudioTrackProcessing(current);
      if (value === "none") {
        delete next.loudnessNormalization;
      } else if (value === "custom") {
        next.loudnessNormalization =
          typeof current.loudnessNormalization === "object" &&
          current.loudnessNormalization.mode === "custom"
            ? { ...current.loudnessNormalization }
            : { ...DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION };
      } else {
        next.loudnessNormalization = value;
      }
      return next;
    });
  };

  const updateCustomNormalization = (field: keyof CustomLoudnessNormalization, value: string) => {
    if (field === "targetLufs") setTargetLufsDraft(value);
    else setMaxTruePeakDraft(value);

    if (value.trim() === "") return;
    const number = Number(value);
    if (!Number.isFinite(number)) return;

    setDraft((current) => {
      const previous = current.loudnessNormalization;
      const custom =
        typeof previous === "object" && previous.mode === "custom"
          ? previous
          : DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION;

      return {
        ...current,
        loudnessNormalization: { ...custom, [field]: number },
      };
    });
  };

  const handleApply = () => {
    controller.applyProcessing(cloneAudioTrackProcessing(draft));
    setOpen(false);
  };

  const analysis = track.loudnessAnalysis;
  const analysisActionLabel =
    analysis.status === "loading"
      ? t("audio.actions.analyzingLoudness")
      : analysis.status === "ready"
        ? t("audio.actions.reanalyzeLoudness")
        : t("audio.actions.analyzeLoudness");

  return (
    <AudioTrackEffectsDialogContext.Provider value={{ openEffects }}>
      {children}

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("audio.dialogs.effects.title", { title })}</DialogTitle>
            <DialogDescription>{t("audio.dialogs.effects.description")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`track-normalization-${track.streamIndex}`}>
                {t("audio.labels.loudnessNormalization")}
              </Label>
              <select
                aria-label={t("audio.accessibility.trackNormalization", { title })}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                id={`track-normalization-${track.streamIndex}`}
                onChange={(event) =>
                  changeNormalization(event.currentTarget.value as NormalizationOption)
                }
                value={normalizationOption(normalization)}
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
                <option value="custom">{t("audio.options.normalizationCustom")}</option>
              </select>
            </div>

            {customNormalization ? (
              <div className="grid gap-3 rounded-md border border-border/70 p-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={`track-custom-lufs-${track.streamIndex}`}>
                    {t("audio.labels.targetLufs")}
                  </Label>
                  <Input
                    id={`track-custom-lufs-${track.streamIndex}`}
                    max={-5}
                    min={-36}
                    onChange={(event) =>
                      updateCustomNormalization("targetLufs", event.currentTarget.value)
                    }
                    onKeyDown={(event) => event.stopPropagation()}
                    step={0.1}
                    type="number"
                    value={targetLufsDraft}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`track-custom-peak-${track.streamIndex}`}>
                    {t("audio.labels.maximumTruePeak")}
                  </Label>
                  <Input
                    id={`track-custom-peak-${track.streamIndex}`}
                    max={0}
                    min={-9}
                    onChange={(event) =>
                      updateCustomNormalization("maxTruePeakDb", event.currentTarget.value)
                    }
                    onKeyDown={(event) => event.stopPropagation()}
                    step={0.1}
                    type="number"
                    value={maxTruePeakDraft}
                  />
                </div>
              </div>
            ) : null}

            <section aria-label={t("audio.labels.loudnessAnalysis")} className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{t("audio.labels.loudnessAnalysis")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("audio.messages.analysisUsesAppliedEffects")}
                  </p>
                </div>
                <Button
                  disabled={analysis.status === "loading"}
                  onClick={controller.analyzeLoudness}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {analysisActionLabel}
                </Button>
              </div>
              {analysis.status === "ready" ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {formatLoudness(analysis.value)}
                </p>
              ) : null}
              {analysis.status === "failed" ? (
                <p className="text-xs text-destructive" role="alert">
                  {analysis.error.message}
                </p>
              ) : null}
            </section>

            {track.preview.status === "loading" ? (
              <p className="text-xs text-muted-foreground" role="status">
                {t("audio.messages.preparingProcessedPreview")}
              </p>
            ) : null}
            {track.preview.status === "failed" ? (
              <p className="text-xs text-destructive" role="alert">
                {track.preview.error.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              {t("common.actions.cancel")}
            </Button>
            <Button
              disabled={!isDirty || !hasValidCustomNormalization}
              onClick={handleApply}
              type="button"
            >
              {t("common.actions.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AudioTrackEffectsDialogContext.Provider>
  );
}

function normalizationOption(
  normalization: AudioTrackProcessing["loudnessNormalization"],
): NormalizationOption {
  if (normalization === undefined) return "none";
  if (typeof normalization === "object") return "custom";
  return normalization;
}

function isInRange(value: string, min: number, max: number): boolean {
  if (value.trim() === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function formatLoudness(analysis: { integratedLufs?: number; truePeakDb?: number }): string {
  const loudness =
    analysis.integratedLufs === undefined ? "—" : `${analysis.integratedLufs.toFixed(1)} LUFS`;

  const peak = analysis.truePeakDb === undefined ? "—" : `${analysis.truePeakDb.toFixed(1)} dBTP`;
  return `${loudness} · ${peak}`;
}

const AudioTrackEffectsDialogContext = createContext<{ openEffects: () => void } | null>(null);

function useAudioTrackEffectsDialog() {
  const context = useContext(AudioTrackEffectsDialogContext);
  if (!context) {
    throw new Error("useAudioTrackEffectsDialog must be used within AudioTrackEffectsDialog");
  }
  return context;
}

export { AudioTrackEffectsDialog, useAudioTrackEffectsDialog };
