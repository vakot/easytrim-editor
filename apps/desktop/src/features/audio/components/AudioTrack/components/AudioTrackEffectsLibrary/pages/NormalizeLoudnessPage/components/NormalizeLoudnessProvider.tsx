import type { ReactNode } from "react";

import { useAudioTrackEffectsDraft } from "../../../../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";
import { NormalizeLoudnessContext } from "../contexts/normalize-loudness-context";
import { useLoudnessAnalysis } from "../hooks/useLoudnessAnalysis";
import { useNormalizeLoudnessForm } from "../hooks/useNormalizeLoudnessForm";
import { useSyncNormalizeLoudnessDraft } from "../hooks/useSyncNormalizeLoudnessDraft";
import type { NormalizationChoice } from "../lib/normalize-loudness-form";

function NormalizeLoudnessProvider({
  children,
  streamIndex,
}: {
  children: ReactNode;
  streamIndex: number;
}) {
  const { draft } = useAudioTrackEffectsDraft();
  const { dirty, dispatchForm, form, valid } = useNormalizeLoudnessForm(draft.initialProcessing);
  const analysis = useLoudnessAnalysis(streamIndex, draft.processing);
  useSyncNormalizeLoudnessDraft(form, dirty);

  const selectedPreset: NormalizationChoice =
    typeof form.normalization === "string" ? form.normalization : "custom";

  const value = { analysis, dirty, dispatchForm, form, selectedPreset, valid };

  return (
    <NormalizeLoudnessContext.Provider value={value}>
      {analysis.hasTrack ? children : null}
    </NormalizeLoudnessContext.Provider>
  );
}

export { NormalizeLoudnessProvider };
