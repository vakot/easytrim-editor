import { useEffect } from "react";

import { useAudioTrackEffectsDraft } from "../../../../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";
import {
  getDraftLoudnessNormalization,
  isNormalizeLoudnessEffectValid,
  type NormalizeLoudnessFormState,
} from "../lib/normalize-loudness-form";

function useSyncNormalizeLoudnessDraft(form: NormalizeLoudnessFormState, dirty: boolean) {
  const { dispatch, draft } = useAudioTrackEffectsDraft();

  useEffect(() => {
    const processing = { ...draft.processing };
    const normalization = getDraftLoudnessNormalization(
      form,
      draft.processing.loudnessNormalization,
      draft.initialProcessing.loudnessNormalization,
    );

    if (normalization === undefined) delete processing.loudnessNormalization;
    else processing.loudnessNormalization = normalization;

    dispatch({ type: "processingChanged", value: processing });
    dispatch({
      type: "effectStatusChanged",
      effectId: "loudnessNormalization",
      dirty,
      valid: isNormalizeLoudnessEffectValid(form),
    });
  }, [dispatch, draft.initialProcessing, draft.processing, dirty, form]);
}

export { useSyncNormalizeLoudnessDraft };
