import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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
  const { i18n, t } = useTranslation();
  const shouldReduceMotion = useReducedMotion() === true;
  const { analysis, dispatchForm, form } = useNormalizeLoudnessContext();
  const motionTransition = { duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" } as const;

  return (
    <>
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

      <div className="space-y-3" data-slot="audio-track-loudness-measurement">
        <div className="flex items-center gap-3">
          {!analysis.isReady ? (
            <Button
              aria-label={
                analysis.isLoading
                  ? t("audio.actions.analyzingLoudness")
                  : t("audio.actions.analyzeLoudness")
              }
              className="h-auto shrink-0 gap-1.5 px-0"
              disabled={analysis.isLoading}
              onClick={analysis.analyze}
              type="button"
              variant="link"
            >
              {analysis.isLoading ? (
                <LoaderCircle
                  aria-hidden="true"
                  className={shouldReduceMotion ? undefined : "animate-spin"}
                />
              ) : null}
              {analysis.isLoading
                ? t("audio.actions.analyzingLoudness")
                : t("audio.actions.analyzeLoudness")}
            </Button>
          ) : null}

          {analysis.value ? (
            <p className="text-sm text-muted-foreground" role="status">
              {formatLoudnessAnalysis(analysis.value, i18n.language)}
            </p>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {analysis.isFailed && analysis.error ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -3 }}
              initial={shouldReduceMotion ? false : { opacity: 0, y: -3 }}
              transition={motionTransition}
            >
              <Alert variant="destructive">
                <AlertDescription>{analysis.error}</AlertDescription>
              </Alert>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

export { NormalizeLoudnessHeader };
