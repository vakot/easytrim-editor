import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useReducer } from "react";
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
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { analyzeTrackLoudness } from "@/app/store/thunks/audio-track-thunks";
import {
  audioTrackLoudnessInputsKey,
  DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION,
  type LoudnessNormalization,
  loudnessNormalizationTargets,
  type LoudnessPreset,
} from "@/domain/audio-processing";
import type { LoudnessAnalysis } from "@/domain/media";

import { normalizationPresetLabel } from "../../../../../lib/audio-level.utils";
import { useAudioTrackEffectsDraft } from "../../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";
import {
  AudioTrackEffectsLibraryPage,
  AudioTrackEffectsLibraryPageAdvanced,
  AudioTrackEffectsLibraryPageBasic,
  AudioTrackEffectsLibraryPageContent,
  AudioTrackEffectsLibraryPageDescription,
  AudioTrackEffectsLibraryPageHeader,
  AudioTrackEffectsLibraryPageHeaderContent,
  AudioTrackEffectsLibraryPageTitle,
  AudioTrackEffectsLibraryPageToggle,
} from "../components/AudioTrackEffectsLibraryPage";

interface NormalizeLoudnessPageProps {
  streamIndex: number;
}

const PRESETS = [
  "webVideo",
  "streaming",
  "broadcast",
] as const satisfies ReadonlyArray<LoudnessPreset>;

type NormalizationChoice = LoudnessPreset | "custom";

interface FormState {
  enabled: boolean;
  initialEnabled: boolean;
  initialNormalization: LoudnessNormalization;
  maxTruePeakDbInput: string;
  normalization: LoudnessNormalization;
  targetLufsInput: string;
}

type FormAction =
  | { type: "enabledChanged"; value: boolean }
  | { type: "presetChanged"; value: NormalizationChoice }
  | { type: "targetChanged"; value: string }
  | { type: "peakChanged"; value: string };

function createFormState(
  processing: ReturnType<typeof useAudioTrackEffectsDraft>["draft"]["processing"],
): FormState {
  const initialEnabled = processing.loudnessNormalization !== undefined;
  const initialNormalization = processing.loudnessNormalization ?? "webVideo";
  return {
    initialEnabled,
    initialNormalization,
    enabled: initialEnabled,
    normalization: initialNormalization,
    targetLufsInput: String(
      typeof initialNormalization === "object"
        ? initialNormalization.targetLufs
        : loudnessNormalizationTargets(initialNormalization).targetLufs,
    ),
    maxTruePeakDbInput: String(
      typeof initialNormalization === "object"
        ? initialNormalization.maxTruePeakDb
        : loudnessNormalizationTargets(initialNormalization).maxTruePeakDb,
    ),
  };
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "enabledChanged":
      return { ...state, enabled: action.value };
    case "presetChanged": {
      if (action.value === "custom") {
        const values =
          typeof state.normalization === "object"
            ? state.normalization
            : DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION;

        return {
          ...state,
          normalization: values,
          targetLufsInput: String(values.targetLufs),
          maxTruePeakDbInput: String(values.maxTruePeakDb),
        };
      }
      const values = loudnessNormalizationTargets(action.value);
      return {
        ...state,
        normalization: action.value,
        targetLufsInput: String(values.targetLufs),
        maxTruePeakDbInput: String(values.maxTruePeakDb),
      };
    }
    case "targetChanged":
      return {
        ...state,
        normalization: {
          mode: "custom",
          targetLufs: Number(action.value),
          maxTruePeakDb:
            typeof state.normalization === "object"
              ? state.normalization.maxTruePeakDb
              : loudnessNormalizationTargets(state.normalization).maxTruePeakDb,
        },
        targetLufsInput: action.value,
      };
    case "peakChanged":
      return {
        ...state,
        normalization: {
          mode: "custom",
          targetLufs:
            typeof state.normalization === "object"
              ? state.normalization.targetLufs
              : loudnessNormalizationTargets(state.normalization).targetLufs,
          maxTruePeakDb: Number(action.value),
        },
        maxTruePeakDbInput: action.value,
      };
  }
}

function NormalizeLoudnessPage({ streamIndex }: NormalizeLoudnessPageProps) {
  const { i18n, t } = useTranslation();
  const shouldReduceMotion = useReducedMotion() === true;
  const dispatch = useAppDispatch();
  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const trim = useAppSelector(selectTrim);
  const source = useAppSelector(selectSourceSelection);
  const { dispatch: dispatchDraft, draft } = useAudioTrackEffectsDraft();
  const [form, dispatchForm] = useReducer(formReducer, draft.initialProcessing, createFormState);

  const analysis = track?.loudnessAnalysis;
  const analysisCacheKey =
    track && trim && source
      ? audioTrackLoudnessInputsKey(source.sourcePath, track.streamIndex, trim, draft.processing)
      : undefined;

  const analysisIsCurrent = analysis?.status === "ready" && analysis.cacheKey === analysisCacheKey;
  const analysisValue =
    analysisIsCurrent && analysis?.status === "ready" ? analysis.value : undefined;

  const analysisReady = analysisValue !== undefined;
  const analysisLoading = analysis?.status === "loading";
  const analysisFailed = analysis?.status === "failed";
  const target = Number(form.targetLufsInput);
  const peak = Number(form.maxTruePeakDbInput);
  const valid =
    Number.isFinite(target) &&
    target >= -36 &&
    target <= -5 &&
    Number.isFinite(peak) &&
    peak >= -9 &&
    peak <= 0;

  const initialChoice = form.initialNormalization;
  const dirty =
    form.enabled !== form.initialEnabled || !sameChoice(initialChoice, form.normalization);

  useEffect(() => {
    const current = draft.processing;
    let normalization: LoudnessNormalization | undefined;
    if (form.enabled) {
      if (typeof form.normalization === "object") {
        normalization = valid
          ? { mode: "custom", targetLufs: target, maxTruePeakDb: peak }
          : typeof current.loudnessNormalization === "object"
            ? current.loudnessNormalization
            : typeof form.initialNormalization === "object"
              ? form.initialNormalization
              : DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION;
      } else {
        normalization = form.normalization;
      }
    }
    const processing = { ...current };
    if (normalization === undefined) delete processing.loudnessNormalization;
    else processing.loudnessNormalization = normalization;
    dispatchDraft({ type: "processingChanged", value: processing });
    dispatchDraft({
      type: "effectStatusChanged",
      effectId: "loudnessNormalization",
      dirty,
      valid: !form.enabled || typeof form.normalization !== "object" || valid,
    });
  }, [dispatchDraft, draft.processing, dirty, form, peak, target, valid]);

  if (!track) return null;

  const selectedPreset: NormalizationChoice =
    typeof form.normalization === "string" ? form.normalization : "custom";

  const motionTransition = { duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" } as const;

  return (
    <AudioTrackEffectsLibraryPage>
      <AudioTrackEffectsLibraryPageHeader>
        <AudioTrackEffectsLibraryPageHeaderContent>
          <AudioTrackEffectsLibraryPageTitle>
            {t("audio.labels.loudnessNormalization")}
          </AudioTrackEffectsLibraryPageTitle>
          <AudioTrackEffectsLibraryPageDescription>
            {t("audio.messages.loudnessNormalizationDescription")}
          </AudioTrackEffectsLibraryPageDescription>
        </AudioTrackEffectsLibraryPageHeaderContent>
        <AudioTrackEffectsLibraryPageToggle
          aria-label={t("audio.labels.loudnessNormalization")}
          checked={form.enabled}
          onCheckedChange={(value) => dispatchForm({ type: "enabledChanged", value })}
        />
      </AudioTrackEffectsLibraryPageHeader>

      <AudioTrackEffectsLibraryPageContent disabled={!form.enabled}>
        <AudioTrackEffectsLibraryPageBasic>
          <div className="grid gap-1.5">
            <Label htmlFor={`track-loudness-preset-${streamIndex}`}>
              {t("audio.labels.normalizationPreset")}
            </Label>
            <div className="flex items-center">
              <Select
                onValueChange={(value) => {
                  if (value === "custom" || PRESETS.includes(value as LoudnessPreset)) {
                    dispatchForm({ type: "presetChanged", value: value as NormalizationChoice });
                  }
                }}
                value={selectedPreset}
              >
                <SelectTrigger
                  aria-label={`${t("audio.labels.normalizationPreset")}: ${t("audio.labels.loudnessNormalization")}`}
                  className="min-w-0 flex-1"
                  id={`track-loudness-preset-${streamIndex}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((preset) => (
                    <SelectItem className="whitespace-nowrap" key={preset} value={preset}>
                      {formatNormalizationPreset(preset, i18n.language, t)}
                    </SelectItem>
                  ))}
                  <SelectItem className="whitespace-nowrap" value="custom">
                    {t("audio.options.normalizationCustom")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </AudioTrackEffectsLibraryPageBasic>

        <AudioTrackEffectsLibraryPageAdvanced>
          <div className="flex items-center gap-3">
            {!analysisReady ? (
              <Button
                aria-label={
                  analysisLoading
                    ? t("audio.actions.analyzingLoudness")
                    : t("audio.actions.analyzeLoudness")
                }
                className="h-auto shrink-0 gap-1.5 px-0"
                disabled={analysisLoading}
                onClick={() => void dispatch(analyzeTrackLoudness(streamIndex))}
                type="button"
                variant="link"
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
            ) : null}

            {analysisValue ? (
              <p className="text-sm text-muted-foreground" role="status">
                {formatAnalysis(analysisValue, i18n.language)}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`track-custom-lufs-${streamIndex}`}>
                {t("audio.labels.targetLufs")}
              </Label>
              <Input
                id={`track-custom-lufs-${streamIndex}`}
                max={-5}
                min={-36}
                onChange={(event) =>
                  dispatchForm({ type: "targetChanged", value: event.currentTarget.value })
                }
                onKeyDown={(event) => event.stopPropagation()}
                step={0.1}
                type="number"
                value={form.targetLufsInput}
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
                  dispatchForm({ type: "peakChanged", value: event.currentTarget.value })
                }
                onKeyDown={(event) => event.stopPropagation()}
                step={0.1}
                type="number"
                value={form.maxTruePeakDbInput}
              />
            </div>
          </div>

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
        </AudioTrackEffectsLibraryPageAdvanced>
      </AudioTrackEffectsLibraryPageContent>
    </AudioTrackEffectsLibraryPage>
  );
}

function sameChoice(left: LoudnessNormalization, right: LoudnessNormalization): boolean {
  if (left === right) return true;
  return (
    typeof left === "object" &&
    typeof right === "object" &&
    left.targetLufs === right.targetLufs &&
    left.maxTruePeakDb === right.maxTruePeakDb
  );
}

function formatNormalizationPreset(
  preset: LoudnessPreset,
  language: string,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const { maxTruePeakDb, targetLufs } = loudnessNormalizationTargets(preset);
  const format = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value).replace(/-/g, "−");

  return `${normalizationPresetLabel(preset, t)} · ${t("audio.messages.normalizedLevelSummary", { peak: format(maxTruePeakDb), target: format(targetLufs) })}`;
}

function formatAnalysis(analysis: LoudnessAnalysis, language: string): string {
  const format = (value: number | undefined, unit: string) => {
    if (value === undefined) return `— ${unit}`;
    const formatted = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
    return `${formatted.replace(/-/g, "−")} ${unit}`;
  };

  return `${format(analysis.integratedLufs, "LUFS")} · ${format(analysis.truePeakDb, "dBTP")}`;
}

export { NormalizeLoudnessPage };
