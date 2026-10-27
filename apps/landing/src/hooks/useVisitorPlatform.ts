import { useEffect, useState } from "react";

import {
  type Architecture,
  detectMacArchitecture,
  detectVisitorPlatform,
} from "../lib/platform.utils";

/** The visitor's platform, and on a Mac its processor once the browser reports it. */
function useVisitorPlatform() {
  const [platform] = useState(() => detectVisitorPlatform(navigator));
  const [architecture, setArchitecture] = useState<Architecture>();

  useEffect(() => {
    if (platform !== "macos") return;
    let active = true;
    void detectMacArchitecture(navigator).then((detected) => {
      if (active) setArchitecture(detected);
    });
    return () => {
      active = false;
    };
  }, [platform]);

  return { architecture, platform };
}

export { useVisitorPlatform };
