import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  AUDIO_TRACK_HIGH_PASS_CUTOFF_PRESETS,
  getAudioTrackSignalEffect,
  removeAudioTrackSignalEffect,
  setAudioTrackSignalEffect,
} from "@/domain/audio-processing";

import { useAudioTrackEffectsDraft } from "../../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";
import {
  AudioTrackEffectsLibraryPage,
  AudioTrackEffectsLibraryPageBasic,
  AudioTrackEffectsLibraryPageContent,
  AudioTrackEffectsLibraryPageDescription,
  AudioTrackEffectsLibraryPageHeader,
  AudioTrackEffectsLibraryPageHeaderContent,
  AudioTrackEffectsLibraryPageTitle,
} from "../components/AudioTrackEffectsLibraryPage";

interface HighPassPageProps {
  streamIndex: number;
}

function HighPassPage({ streamIndex }: HighPassPageProps) {
  const { t } = useTranslation();
  const { dispatch, draft } = useAudioTrackEffectsDraft();
  const cutoffHz = getAudioTrackSignalEffect(draft.processing, "highPass", "cleanup")?.cutoffHz;
  const value = cutoffHz?.toString() ?? "off";

  return (
    <AudioTrackEffectsLibraryPage>
      <AudioTrackEffectsLibraryPageHeader>
        <AudioTrackEffectsLibraryPageHeaderContent>
          <AudioTrackEffectsLibraryPageTitle>
            {t("audio.labels.highPass")}
          </AudioTrackEffectsLibraryPageTitle>
          <AudioTrackEffectsLibraryPageDescription>
            {t("audio.messages.highPassDescription")}
          </AudioTrackEffectsLibraryPageDescription>
        </AudioTrackEffectsLibraryPageHeaderContent>
      </AudioTrackEffectsLibraryPageHeader>

      <AudioTrackEffectsLibraryPageContent>
        <AudioTrackEffectsLibraryPageBasic>
          <div className="grid gap-1.5">
            <Label htmlFor={`track-high-pass-cutoff-${streamIndex}`}>
              {t("audio.labels.highPassCutoff")}
            </Label>
            <Select
              onValueChange={(nextValue) => {
                const nextCutoffHz = AUDIO_TRACK_HIGH_PASS_CUTOFF_PRESETS.find(
                  (preset) => preset.toString() === nextValue,
                );

                dispatch({
                  type: "processingChanged",
                  value:
                    nextCutoffHz === undefined
                      ? removeAudioTrackSignalEffect(draft.processing, "highPass", "cleanup")
                      : setAudioTrackSignalEffect(draft.processing, {
                          cutoffHz: nextCutoffHz,
                          stage: "cleanup",
                          type: "highPass",
                        }),
                });
              }}
              value={value}
            >
              <SelectTrigger
                aria-label={`${t("audio.labels.highPassCutoff")}: ${t("audio.labels.highPass")}`}
                className="w-full"
                id={`track-high-pass-cutoff-${streamIndex}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">{t("audio.options.highPassOff")}</SelectItem>
                {AUDIO_TRACK_HIGH_PASS_CUTOFF_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset.toString()}>
                    {preset} Hz
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </AudioTrackEffectsLibraryPageBasic>
      </AudioTrackEffectsLibraryPageContent>
    </AudioTrackEffectsLibraryPage>
  );
}

export { HighPassPage };
