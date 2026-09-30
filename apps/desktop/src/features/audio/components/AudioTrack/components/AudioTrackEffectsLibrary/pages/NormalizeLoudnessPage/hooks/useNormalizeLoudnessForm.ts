import { useReducer } from "react";

import type { AudioTrackProcessing } from "@/domain/audio-processing";

import {
  createNormalizeLoudnessFormState,
  isNormalizeLoudnessFormDirty,
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
  };
}

export { useNormalizeLoudnessForm };
