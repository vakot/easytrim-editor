import { Check, LoaderCircle, RotateCw } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { optimizedExportSettingsChangedRequested } from "@/app/store/thunks/export-thunks";
import { selectedAudioTracks } from "@/domain/audio-export";
import type { ExportSettings } from "@/domain/editing-instance";
import type { LoudnessAnalysis, LoudnessPreset } from "@/domain/media";
import { analyzeAudioLoudness } from "@/lib/tauri/media";
import { normalizeAppError } from "@/lib/tauri/media.utils";

const MotionButton = motion.create(Button);

interface LoudnessControlsProps {
  settings: ExportSettings;
}

type AnalysisState =
  | { requestKey: string; status: "analyzing" }
  | { requestKey: string; result: LoudnessAnalysis; status: "success" }
  | { requestKey: string; result: LoudnessAnalysis; status: "ready" }
  | { error: string; requestKey: string; status: "failed" };

const LOUDNESS_PRESETS: Array<{ id: LoudnessPreset; integratedLufs: number; truePeakDb: number }> =
  [
    { id: "webVideo", integratedLufs: -14, truePeakDb: -1 },
    { id: "streaming", integratedLufs: -16, truePeakDb: -1.5 },
    { id: "broadcast", integratedLufs: -23, truePeakDb: -2 },
  ];

function formatMeasurement(value: number | undefined, unit: string, unavailable: string) {
  return value === undefined
    ? `${unavailable} ${unit}`
    : `${value.toFixed(1).replace("-", "−")} ${unit}`;
}

interface LoudnessPresetSelectProps {
  analysis: LoudnessAnalysis | null;
  onPresetChange: (preset: LoudnessPreset | undefined) => void;
  value: LoudnessPreset | undefined;
}

function LoudnessPresetSelect({ analysis, onPresetChange, value }: LoudnessPresetSelectProps) {
  const { t } = useTranslation();
  const defaultLabel = analysis
    ? t("export.dialogs.optimized.loudness.defaultWithAnalysis", {
        integratedLufs: formatMeasurement(
          analysis.integratedLufs,
          "LUFS",
          t("export.dialogs.optimized.loudness.unavailable"),
        ),
        truePeakDb: formatMeasurement(
          analysis.truePeakDb,
          "dBTP",
          t("export.dialogs.optimized.loudness.unavailable"),
        ),
      })
    : t("export.dialogs.optimized.loudness.default");

  return (
    <Select
      onValueChange={(selectedValue) =>
        onPresetChange(selectedValue === "default" ? undefined : (selectedValue as LoudnessPreset))
      }
      value={value ?? "default"}
    >
      <SelectTrigger className="min-w-0 flex-1" id="export-loudness-preset">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">{defaultLabel}</SelectItem>
        {LOUDNESS_PRESETS.map((preset) => (
          <SelectItem key={preset.id} value={preset.id}>
            {preset.id === "webVideo"
              ? t("export.dialogs.optimized.loudness.presets.webVideo")
              : preset.id === "streaming"
                ? t("export.dialogs.optimized.loudness.presets.streaming")
                : t("export.dialogs.optimized.loudness.presets.broadcast")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type LoudnessAnalysisButtonState = "closed" | "error" | "idle" | "loading" | "success";

interface LoudnessAnalysisButtonProps {
  disabled: boolean;
  onAnalyze: () => void;
  state: LoudnessAnalysisButtonState;
}

function LoudnessAnalysisButton({ disabled, onAnalyze, state }: LoudnessAnalysisButtonProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion() === true;
  const buttonLabel =
    state === "error"
      ? t("export.dialogs.optimized.loudness.retry")
      : state === "loading"
        ? t("export.dialogs.optimized.loudness.analyzing")
        : state === "success"
          ? t("export.dialogs.optimized.loudness.analyzed")
          : t("export.dialogs.optimized.loudness.analyze");

  const buttonVariant =
    state === "error" ? "destructive" : state === "success" ? "success" : "outline";

  const compact = state === "loading" || state === "success";
  const transition = { duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" } as const;

  return (
    <AnimatePresence initial={false} mode="wait">
      {state !== "closed" ? (
        <motion.div
          animate={{
            marginInlineStart: "0.5rem",
            opacity: 1,
            width: "auto",
          }}
          className="flex shrink-0 overflow-hidden"
          exit={{
            marginInlineStart: 0,
            opacity: 0,
            width: 0,
          }}
          initial={
            shouldReduceMotion
              ? false
              : {
                  marginInlineStart: 0,
                  opacity: 0,
                  width: 0,
                }
          }
          transition={transition}
        >
          <MotionButton
            animate={{ paddingInline: compact ? "0.4375rem" : "0.625rem" }}
            aria-label={buttonLabel}
            className="gap-0 overflow-hidden transition-colors"
            disabled={disabled}
            initial={false}
            onClick={onAnalyze}
            size="default"
            transition={transition}
            type="button"
            variant={buttonVariant}
          >
            <motion.span
              animate={{
                width: state === "idle" ? 0 : "1rem",
                opacity: state === "idle" ? 0 : 1,
                marginInlineEnd: state === "error" ? "0.375rem" : 0,
              }}
              aria-hidden="true"
              className="flex shrink-0 items-center overflow-hidden"
              initial={false}
              transition={transition}
            >
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  className="flex size-4 shrink-0 items-center justify-center"
                  exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -3 }}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 3 }}
                  key={state}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.14, ease: "easeOut" }}
                >
                  {state === "loading" ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className={shouldReduceMotion ? undefined : "animate-spin"}
                    />
                  ) : state === "success" ? (
                    <Check aria-hidden="true" />
                  ) : state === "error" ? (
                    <RotateCw aria-hidden="true" />
                  ) : null}
                </motion.span>
              </AnimatePresence>
            </motion.span>
            {(["idle", "error"] as const).map((labelState) => (
              <motion.span
                animate={{
                  opacity: state === labelState ? 1 : 0,
                  width: state === labelState ? "auto" : 0,
                }}
                aria-hidden={state !== labelState}
                className="min-w-0 shrink-0 overflow-hidden whitespace-nowrap"
                initial={false}
                key={labelState}
                transition={transition}
              >
                {t(
                  labelState === "error"
                    ? "export.dialogs.optimized.loudness.retry"
                    : "export.dialogs.optimized.loudness.analyze",
                )}
              </motion.span>
            ))}
          </MotionButton>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function LoudnessControls({ settings }: LoudnessControlsProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion() === true;
  const dispatch = useAppDispatch();
  const source = useAppSelector(selectSourceSelection);
  const trim = useAppSelector(selectTrim);
  const tracks = useAppSelector(selectAudioTracks);
  const master = useAppSelector(selectMasterAudio);
  const mergeAudio = useAppSelector(selectMergeAudio);
  const audioTracks = selectedAudioTracks(tracks, master);
  const request =
    source && trim
      ? {
          audioTracks,
          mergeAudio,
          sourcePath: source.sourcePath,
          trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
        }
      : null;

  const requestKey = JSON.stringify(request);
  const requestId = useRef(0);
  const analysisAbortController = useRef<AbortController | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null);

  useEffect(() => {
    requestId.current += 1;
    return () => {
      requestId.current += 1;
      analysisAbortController.current?.abort();
      analysisAbortController.current = null;
    };
  }, [requestKey]);

  useEffect(() => {
    if (analysisState?.status !== "success" || analysisState.requestKey !== requestKey) return;

    const timeoutId = window.setTimeout(() => {
      setAnalysisState((current) =>
        current?.status === "success" && current.requestKey === requestKey
          ? { ...current, status: "ready" }
          : current,
      );
    }, 1_000);

    return () => window.clearTimeout(timeoutId);
  }, [analysisState, requestKey]);

  const updateSettings = (loudnessPreset: LoudnessPreset | undefined) => {
    void dispatch(optimizedExportSettingsChangedRequested({ ...settings, loudnessPreset }));
  };

  const analyze = async () => {
    if (!request) return;
    analysisAbortController.current?.abort();
    const controller = new AbortController();
    analysisAbortController.current = controller;
    const currentRequestId = ++requestId.current;
    setAnalysisState({ requestKey, status: "analyzing" });
    try {
      const result = await analyzeAudioLoudness(request, controller.signal);
      if (requestId.current === currentRequestId) {
        setAnalysisState({ requestKey, result, status: "success" });
      }
    } catch (cause: unknown) {
      if (requestId.current === currentRequestId) {
        const normalized = normalizeAppError(cause);
        setAnalysisState({
          requestKey,
          error: normalized.message || t("export.dialogs.optimized.loudness.analysisFailed"),
          status: "failed",
        });
      }
    } finally {
      if (analysisAbortController.current === controller) {
        analysisAbortController.current = null;
      }
    }
  };

  const isAnalyzing =
    analysisState?.requestKey === requestKey && analysisState.status === "analyzing";

  const isSuccess = analysisState?.requestKey === requestKey && analysisState.status === "success";

  const analysis =
    analysisState?.requestKey === requestKey &&
    (analysisState.status === "success" || analysisState.status === "ready")
      ? analysisState.result
      : null;

  const error =
    analysisState?.requestKey === requestKey && analysisState.status === "failed"
      ? analysisState.error
      : null;

  const buttonState: LoudnessAnalysisButtonState = error
    ? "error"
    : isAnalyzing
      ? "loading"
      : isSuccess
        ? "success"
        : analysisState?.requestKey === requestKey && analysisState.status === "ready"
          ? "closed"
          : "idle";

  return (
    <section className="grid gap-1.5">
      <Label htmlFor="export-loudness-preset">{t("export.dialogs.optimized.loudness.label")}</Label>
      <div className="flex items-center">
        <LoudnessPresetSelect
          analysis={analysis}
          onPresetChange={updateSettings}
          value={settings.loudnessPreset}
        />
        <LoudnessAnalysisButton
          disabled={
            !request ||
            audioTracks.length === 0 ||
            buttonState === "loading" ||
            buttonState === "success" ||
            settings.loudnessPreset !== undefined
          }
          onAnalyze={() => void analyze()}
          state={buttonState}
        />
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
          >
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

export { LoudnessControls };
