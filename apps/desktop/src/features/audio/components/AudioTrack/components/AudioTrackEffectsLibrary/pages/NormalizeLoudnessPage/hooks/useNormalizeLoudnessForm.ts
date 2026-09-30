import { useReducer } from "react";

import type { AudioTrackProcessing } from "@/domain/audio-processing";

import {
  createNormalizeLoudnessFormState,
  isNormalizeLoudnessFormDirty,
  isNormalizeLoudnessFormValid,
  normalizeLoudnessFormReducer,
} from "../lib/normalize-loudness-form";

function useNormalizeLoudnessForm(initialProcessing: AudioTrackProcessing) {
  const [form, dispatchForm] = useReducer(
    normalizeLoudnessFormReducer,
    initialProcessing,
    createNormalizeLoudnessFormState,
  );

  return {
    dirty: isNormalizeLoudnessFormDirty(form),
    dispatchForm,
    form,
    valid: isNormalizeLoudnessFormValid(form),
  };
}

export { useNormalizeLoudnessForm };
