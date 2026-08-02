import { useEffect, useState } from "react";

import packageJson from "../../../../../../package.json";

import { checkForUpdate, type AvailableUpdate } from "../release-check";

interface ReleaseCheckState {
  update: AvailableUpdate | null;
}

export function useReleaseCheck(): ReleaseCheckState {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void checkForUpdate(packageJson.version, controller.signal)
      .then(setUpdate)
      .catch(() => {
        // Update checks are best-effort and must never affect editing.
      });

    return () => controller.abort();
  }, []);

  return { update };
}
