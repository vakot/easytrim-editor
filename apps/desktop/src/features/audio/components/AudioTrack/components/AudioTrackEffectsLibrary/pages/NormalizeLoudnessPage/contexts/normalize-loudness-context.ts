import { createContext, type Dispatch, useContext } from "react";

import type { useLoudnessAnalysis } from "../hooks/useLoudnessAnalysis";
import type {
  NormalizationChoice,
  NormalizeLoudnessFormAction,
  NormalizeLoudnessFormState,
} from "../lib/normalize-loudness-form";

interface NormalizeLoudnessContextValue {
  analysis: ReturnType<typeof useLoudnessAnalysis>;
  dispatchForm: Dispatch<NormalizeLoudnessFormAction>;
  form: NormalizeLoudnessFormState;
  selectedPreset: NormalizationChoice;
}

const NormalizeLoudnessContext = createContext<NormalizeLoudnessContextValue | null>(null);

function useNormalizeLoudnessContext() {
  const context = useContext(NormalizeLoudnessContext);
  if (!context) {
    throw new Error("useNormalizeLoudnessContext must be used within NormalizeLoudnessProvider");
  }
  return context;
}

export { NormalizeLoudnessContext, useNormalizeLoudnessContext };
export type { NormalizeLoudnessContextValue };
