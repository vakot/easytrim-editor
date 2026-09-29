import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { analyzeTrackLoudness } from "@/app/store/thunks/audio-track-thunks";
import {
  type LoudnessNormalization,
  type LoudnessPreset,
  sameAudioTrackProcessing,
} from "@/domain/audio-processing";
import type { LoudnessAnalysis } from "@/domain/media";

import {
  type NormalizationOption,
  useAudioTrackEffectsDraft,
} from "../contexts/audio-track-effects-draft-context";

interface LoudnessControlsProps {
  streamIndex: number;
}

const PRESETS = [
  { id: "webVideo", translationKey: "export.dialogs.optimized.loudness.presets.webVideo" },
  { id: "streaming", translationKey: "export.dialogs.optimized.loudness.presets.streaming" },
  { id: "broadcast", translationKey: "export.dialogs.optimized.loudness.presets.broadcast" },
] as const satisfies ReadonlyArray<{ id: LoudnessPreset; translationKey: string }>;

const NORMALIZATION_OPTIONS: NormalizationOption[] = [
  "none",
  "webVideo",
  "streaming",
  "broadcast",
  "custom",
];

function LoudnessControls({ streamIndex }: LoudnessControlsProps) {
  const { i18n, t } = useTranslation();
  const shouldReduceMotion = useReducedMotion() === true;
  const dispatch = useAppDispatch();
  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const { dispatch: dispatchDraft, draft } = useAudioTrackEffectsDraft();

  if (!track) return null;

  const normalization = draft.processing.loudnessNormalization;
  const analysis = track.loudnessAnalysis;
  const analysisUsesAppliedSettings = !sameAudioTrackProcessing(track.processing, draft.processing);
  const targetLufsDraft = draft.targetLufsInput;
  const maxTruePeakDraft = draft.maxTruePeakDbInput;
  const selectedOption = getNormalizationOption(normalization);
  const customNormalization = selectedOption === "custom";
  const analysisReady = analysis.status === "ready";
  const analysisLoading = analysis.status === "loading";
  const analysisFailed = analysis.status === "failed";
  const motionTransition = { duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" } as const;

  return (
    <section className="grid gap-1.5">
      <Label htmlFor={`track-loudness-preset-${streamIndex}`}>
        {t("audio.labels.loudnessNormalization")}
      </Label>
      <div className="flex items-center">
        <Select
          onValueChange={(value) => {
            if (NORMALIZATION_OPTIONS.includes(value as NormalizationOption)) {
              dispatchDraft({ type: "normalizationSelected", value: value as NormalizationOption });
            }
          }}
          value={selectedOption}
        >
          <SelectTrigger className="min-w-0 flex-1" id={`track-loudness-preset-${streamIndex}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("audio.options.normalizationNone")}</SelectItem>
            {PRESETS.map(({ id, translationKey }) => (
              <SelectItem key={id} value={id}>
                {t(translationKey)}
              </SelectItem>
            ))}
            <SelectItem value="custom">{t("audio.options.normalizationCustom")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          aria-label={
            analysisLoading
              ? t("audio.actions.analyzingLoudness")
              : t("audio.actions.analyzeLoudness")
          }
          className="ms-2 shrink-0 gap-1.5"
          disabled={analysisLoading}
          onClick={() => void dispatch(analyzeTrackLoudness(streamIndex))}
          type="button"
          variant={analysisFailed ? "destructive" : analysisReady ? "success" : "outline"}
        >
          {analysisLoading ? (
            <LoaderCircle
              aria-hidden="true"
              className={shouldReduceMotion ? undefined : "animate-spin"}
            />
          ) : null}
          {analysisLoading
            ? t("audio.actions.analyzingLoudness")
            : t("audio.actions.analyzeLoudness")}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {analysisUsesAppliedSettings ? (
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-muted-foreground"
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -3 }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -3 }}
            transition={motionTransition}
          >
            {t("audio.messages.analysisUsesAppliedEffects")}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {customNormalization ? (
          <motion.div
            animate={{ opacity: 1, height: "auto" }}
            className="grid gap-3 overflow-hidden pt-1.5 sm:grid-cols-2"
            exit={{ opacity: 0, height: 0 }}
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            transition={motionTransition}
          >
            <div className="grid gap-1.5">
              <Label htmlFor={`track-custom-lufs-${streamIndex}`}>
                {t("audio.labels.targetLufs")}
              </Label>
              <Input
                id={`track-custom-lufs-${streamIndex}`}
                max={-5}
                min={-36}
                onChange={(event) =>
                  dispatchDraft({
                    field: "targetLufs",
                    type: "customValueChanged",
                    value: event.currentTarget.value,
                  })
                }
                onKeyDown={(event) => event.stopPropagation()}
                step={0.1}
                type="number"
                value={targetLufsDraft}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`track-custom-peak-${streamIndex}`}>
                {t("audio.labels.maximumTruePeak")}
              </Label>
              <Input
                id={`track-custom-peak-${streamIndex}`}
                max={0}
                min={-9}
                onChange={(event) =>
                  dispatchDraft({
                    field: "maxTruePeakDb",
                    type: "customValueChanged",
                    value: event.currentTarget.value,
                  })
                }
                onKeyDown={(event) => event.stopPropagation()}
                step={0.1}
                type="number"
                value={maxTruePeakDraft}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {analysisReady && analysis.value ? (
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-muted-foreground"
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -3 }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -3 }}
            role="status"
            transition={motionTransition}
          >
            {formatAnalysis(analysis.value, i18n.language)}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {analysisFailed && analysis.error ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -3 }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -3 }}
            transition={motionTransition}
          >
            <Alert variant="destructive">
              <AlertDescription>{analysis.error.message}</AlertDescription>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function getNormalizationOption(
  normalization: LoudnessNormalization | undefined,
): NormalizationOption {
  if (normalization === undefined) return "none";
  if (typeof normalization === "object") return "custom";
  return normalization;
}

function formatAnalysis(analysis: LoudnessAnalysis, language: string): string {
  const format = (value: number | undefined, unit: string) => {
    if (value === undefined) return `— ${unit}`;
    const formatted = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
    return `${formatted.replace(/-/g, "−")} ${unit}`;
  };

  return `${format(analysis.integratedLufs, "LUFS")} · ${format(analysis.truePeakDb, "dBTP")}`;
}

export { LoudnessControls };
export type { NormalizationOption };
