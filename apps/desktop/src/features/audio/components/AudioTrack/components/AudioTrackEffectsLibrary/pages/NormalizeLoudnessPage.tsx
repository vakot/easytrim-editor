import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
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
import { loudnessNormalizationTargets, type LoudnessPreset } from "@/domain/audio-processing";
import type { LoudnessAnalysis } from "@/domain/media";

import { normalizationPresetLabel } from "../../../../../lib/audio-level.utils";
import { useAudioTrackEffectsDraft } from "../../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";
import {
  AudioTrackEffectsLibraryPage,
  AudioTrackEffectsLibraryPageAdvanced,
  AudioTrackEffectsLibraryPageBasic,
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

const NORMALIZATION_PRESETS = ["default", ...PRESETS, "custom"] as const;

function NormalizeLoudnessPage({ streamIndex }: NormalizeLoudnessPageProps) {
  const { i18n, t } = useTranslation();
  const shouldReduceMotion = useReducedMotion() === true;
  const dispatch = useAppDispatch();
  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const { dispatch: dispatchDraft, draft } = useAudioTrackEffectsDraft();

  const analysis = track?.loudnessAnalysis;
  const analysisValue = analysis?.status === "ready" ? analysis.value : undefined;
  const selectedPreset = draft.normalizationPreset;
  const analysisReady = analysisValue !== undefined;
  const analysisLoading = analysis?.status === "loading";
  const analysisFailed = analysis?.status === "failed";
  const motionTransition = { duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" } as const;

  useEffect(() => {
    if (!analysisValue) return;

    dispatchDraft({
      type: "analysisValuesReceived",
      value: {
        integratedLufs: analysisValue.integratedLufs,
        truePeakDb: analysisValue.truePeakDb,
      },
    });
  }, [analysisValue, dispatchDraft, selectedPreset]);

  if (!track) return null;

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
          checked={draft.normalizationEnabled}
          onCheckedChange={(checked) =>
            dispatchDraft({ type: "normalizationEnabledChanged", value: checked })
          }
        />
      </AudioTrackEffectsLibraryPageHeader>

      <AudioTrackEffectsLibraryPageBasic>
        <div className="grid gap-1.5">
          <Label htmlFor={`track-loudness-preset-${streamIndex}`}>
            {t("audio.labels.normalizationPreset")}
          </Label>
          <div className="flex items-center">
            <Select
              onValueChange={(value) => {
                if (
                  NORMALIZATION_PRESETS.includes(value as (typeof NORMALIZATION_PRESETS)[number])
                ) {
                  dispatchDraft({
                    type: "normalizationSelected",
                    value: value as (typeof NORMALIZATION_PRESETS)[number],
                  });
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
                <SelectItem className="whitespace-nowrap" value="default">
                  {formatDefaultPreset(
                    analysisValue?.integratedLufs,
                    analysisValue?.truePeakDb,
                    i18n.language,
                    t,
                  )}
                </SelectItem>
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
            <AnimatePresence initial={false}>
              {!analysisReady ? (
                <motion.div
                  animate={{ opacity: 1, width: "auto", marginInlineStart: 8 }}
                  className="overflow-hidden"
                  exit={{ opacity: 0, width: 0, marginInlineStart: 0 }}
                  initial={
                    shouldReduceMotion ? false : { opacity: 0, width: 0, marginInlineStart: 0 }
                  }
                  transition={motionTransition}
                >
                  <Button
                    aria-label={
                      analysisLoading
                        ? t("audio.actions.analyzingLoudness")
                        : t("audio.actions.analyzeLoudness")
                    }
                    className="shrink-0 gap-1.5"
                    disabled={analysisLoading}
                    onClick={() => void dispatch(analyzeTrackLoudness(streamIndex))}
                    type="button"
                    variant={analysisFailed ? "destructive" : "outline"}
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
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </AudioTrackEffectsLibraryPageBasic>

      <AudioTrackEffectsLibraryPageAdvanced>
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
                dispatchDraft({
                  field: "targetLufs",
                  type: "customValueChanged",
                  value: event.currentTarget.value,
                })
              }
              onKeyDown={(event) => event.stopPropagation()}
              step={0.1}
              type="number"
              value={draft.targetLufsInput}
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
              value={draft.maxTruePeakDbInput}
            />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {analysisValue ? (
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-muted-foreground"
              exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -3 }}
              initial={shouldReduceMotion ? false : { opacity: 0, y: -3 }}
              role="status"
              transition={motionTransition}
            >
              {formatAnalysis(analysisValue, i18n.language)}
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
      </AudioTrackEffectsLibraryPageAdvanced>
    </AudioTrackEffectsLibraryPage>
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

  return `${normalizationPresetLabel(preset, t)} · ${t("audio.messages.normalizedLevelSummary", {
    peak: format(maxTruePeakDb),
    target: format(targetLufs),
  })}`;
}

function formatDefaultPreset(
  targetLufs: number | undefined,
  maxTruePeakDb: number | undefined,
  language: string,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (targetLufs === undefined || maxTruePeakDb === undefined) {
    return t("audio.options.normalizationDefault");
  }

  const format = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value).replace(/-/g, "−");

  return `${t("audio.options.normalizationDefault")} · ${t(
    "audio.messages.normalizedLevelSummary",
    {
      peak: format(maxTruePeakDb),
      target: format(targetLufs),
    },
  )}`;
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
