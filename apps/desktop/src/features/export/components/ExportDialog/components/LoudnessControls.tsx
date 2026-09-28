import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

interface LoudnessControlsProps {
  settings: ExportSettings;
}

type AnalysisState =
  | { requestKey: string; status: "analyzing" }
  | { requestKey: string; result: LoudnessAnalysis; status: "ready" }
  | { error: string; requestKey: string; status: "failed" };

const LOUDNESS_PRESETS: Array<{ id: LoudnessPreset; integratedLufs: number; truePeakDb: number }> =
  [
    { id: "webVideo", integratedLufs: -14, truePeakDb: -1 },
    { id: "streaming", integratedLufs: -16, truePeakDb: -1.5 },
    { id: "broadcast", integratedLufs: -23, truePeakDb: -2 },
  ];

function LoudnessControls({ settings }: LoudnessControlsProps) {
  const { t } = useTranslation();
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
  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null);

  useEffect(() => {
    requestId.current += 1;
    return () => {
      requestId.current += 1;
    };
  }, [requestKey]);

  const updateSettings = (loudnessPreset: LoudnessPreset | undefined) => {
    void dispatch(optimizedExportSettingsChangedRequested({ ...settings, loudnessPreset }));
  };

  const analyze = async () => {
    if (!request) return;
    const currentRequestId = ++requestId.current;
    setAnalysisState({ requestKey, status: "analyzing" });
    try {
      const result = await analyzeAudioLoudness(request);
      if (requestId.current === currentRequestId) {
        setAnalysisState({ requestKey, result, status: "ready" });
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
    }
  };

  const checked = settings.loudnessPreset !== undefined;
  const selectedPreset = LOUDNESS_PRESETS.find(({ id }) => id === settings.loudnessPreset);
  const isAnalyzing =
    analysisState?.requestKey === requestKey && analysisState.status === "analyzing";

  const analysis =
    analysisState?.requestKey === requestKey && analysisState.status === "ready"
      ? analysisState.result
      : null;

  const error =
    analysisState?.requestKey === requestKey && analysisState.status === "failed"
      ? analysisState.error
      : null;

  return (
    <section className="grid gap-2 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <Checkbox
          checked={checked}
          id="export-loudness-normalization"
          onCheckedChange={(value) =>
            updateSettings(value === true ? (settings.loudnessPreset ?? "streaming") : undefined)
          }
        />
        <div className="grid gap-1">
          <Label htmlFor="export-loudness-normalization">
            {t("export.dialogs.optimized.loudness.normalize")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("export.dialogs.optimized.loudness.description")}
          </p>
        </div>
      </div>

      {checked ? (
        <div className="grid gap-1.5">
          <Label htmlFor="export-loudness-preset">
            {t("export.dialogs.optimized.loudness.target")}
          </Label>
          <Select
            onValueChange={(value) => updateSettings(value as LoudnessPreset)}
            value={settings.loudnessPreset}
          >
            <SelectTrigger className="w-full" id="export-loudness-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOUDNESS_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.id === "webVideo"
                    ? t("export.dialogs.optimized.loudness.presets.webVideo", {
                        integratedLufs: preset.integratedLufs,
                        truePeakDb: preset.truePeakDb,
                      })
                    : preset.id === "streaming"
                      ? t("export.dialogs.optimized.loudness.presets.streaming", {
                          integratedLufs: preset.integratedLufs,
                          truePeakDb: preset.truePeakDb,
                        })
                      : t("export.dialogs.optimized.loudness.presets.broadcast", {
                          integratedLufs: preset.integratedLufs,
                          truePeakDb: preset.truePeakDb,
                        })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("export.dialogs.optimized.loudness.targetDetails", {
              integratedLufs: selectedPreset?.integratedLufs,
              truePeakDb: selectedPreset?.truePeakDb,
            })}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!request || audioTracks.length === 0 || isAnalyzing}
          onClick={() => void analyze()}
          size="sm"
          variant="outline"
        >
          {isAnalyzing
            ? t("export.dialogs.optimized.loudness.analyzing")
            : t("export.dialogs.optimized.loudness.analyze")}
        </Button>
        {analysis ? (
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {t("export.dialogs.optimized.loudness.result", {
              integratedLufs:
                analysis.integratedLufs === undefined
                  ? t("export.dialogs.optimized.loudness.unavailable")
                  : `${analysis.integratedLufs.toFixed(1)} LUFS`,
              truePeakDb:
                analysis.truePeakDb === undefined
                  ? t("export.dialogs.optimized.loudness.unavailable")
                  : `${analysis.truePeakDb.toFixed(1)} dBTP`,
            })}
          </p>
        ) : null}
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

export { LoudnessControls };
