import { createContext, useContext } from "react";

interface UiScaleFeedbackContextValue {
  scalePercent: number | null;
  showScale: (scalePercent: number) => void;
}

const UiScaleFeedbackContext = createContext<UiScaleFeedbackContextValue>({
  scalePercent: null,
  showScale: () => undefined,
});

function useUiScaleFeedback() {
  return useContext(UiScaleFeedbackContext);
}

export { UiScaleFeedbackContext, useUiScaleFeedback };
export type { UiScaleFeedbackContextValue };
