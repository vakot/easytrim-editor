import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { UiScaleFeedbackContext } from "@/app/contexts/ui-scale-feedback-context";

const feedbackDurationMs = 900;

function UiScaleFeedbackProvider({ children }: { children: ReactNode }) {
  const [scalePercent, setScalePercent] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showScale = useCallback((nextScalePercent: number) => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    setScalePercent(nextScalePercent);
    timeoutRef.current = window.setTimeout(() => {
      setScalePercent(null);
      timeoutRef.current = null;
    }, feedbackDurationMs);
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  return (
    <UiScaleFeedbackContext.Provider value={{ scalePercent, showScale }}>
      {children}
    </UiScaleFeedbackContext.Provider>
  );
}

export { UiScaleFeedbackProvider };
