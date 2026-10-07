import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import {
  AudioTrackEffectsLibraryPageDescription,
  AudioTrackEffectsLibraryPageHeader,
  AudioTrackEffectsLibraryPageHeaderContent,
  AudioTrackEffectsLibraryPageTitle,
  AudioTrackEffectsLibraryPageToggle,
} from "../../../components/AudioTrackEffectsLibraryPage";
import { useNormalizeLoudnessContext } from "../contexts/normalize-loudness-context";
import { formatLoudnessAnalysis } from "../lib/normalize-loudness.utils";

function NormalizeLoudnessHeader() {
  const { t } = useTranslation();
  const { dispatchForm, form } = useNormalizeLoudnessContext();

  return (
    <AudioTrackEffectsLibraryPageHeader>
      <AudioTrackEffectsLibraryPageHeaderContent>
        <AudioTrackEffectsLibraryPageTitle>
          {t("audio.normalization.labels.loudnessNormalization")}
        </AudioTrackEffectsLibraryPageTitle>
        <AudioTrackEffectsLibraryPageDescription>
          {t("audio.normalization.messages.loudnessNormalizationDescription")}
        </AudioTrackEffectsLibraryPageDescription>
        <NormalizeLoudnessAnalysis />
      </AudioTrackEffectsLibraryPageHeaderContent>
      <AudioTrackEffectsLibraryPageToggle
        aria-label={t("audio.normalization.labels.loudnessNormalization")}
        checked={form.enabled}
        onCheckedChange={(value) => dispatchForm({ type: "enabledChanged", value })}
      />
    </AudioTrackEffectsLibraryPageHeader>
  );
}

function NormalizeLoudnessAnalysis() {
  const { i18n, t } = useTranslation();
  const { analysis } = useNormalizeLoudnessContext();

  return (
    <div className="mt-1 space-y-3" data-slot="audio-track-loudness-measurement">
      <div className="flex items-center gap-3">
        {!analysis.isReady ? (
          <Button
            aria-label={
              analysis.isLoading
                ? t("audio.loudness.actions.analyzingLoudness")
                : t("audio.loudness.actions.analyzeLoudness")
            }
            className="h-auto shrink-0 gap-1.5 px-0"
            disabled={analysis.isLoading}
            onClick={analysis.analyze}
            type="button"
            variant="link"
          >
            {analysis.isLoading ? <Spinner aria-hidden="true" /> : null}
            {analysis.isLoading
              ? t("audio.loudness.actions.analyzingLoudness")
              : t("audio.loudness.actions.analyzeLoudness")}
          </Button>
        ) : null}

        {analysis.value ? (
          <p className="text-sm text-muted-foreground" role="status">
            {formatLoudnessAnalysis(analysis.value, i18n.language)}
          </p>
        ) : null}
      </div>

      {analysis.isFailed && analysis.error ? (
        <Alert variant="destructive">
          <AlertDescription>{analysis.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export { NormalizeLoudnessHeader };
