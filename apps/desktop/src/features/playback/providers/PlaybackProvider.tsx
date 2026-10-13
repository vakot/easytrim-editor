import { type ReactNode, useEffect, useLayoutEffect, useMemo, useState } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectSourceLoadToken,
  selectSourceMedia,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { useAudioPlaybackAdapter } from "@/features/audio";
import { usePreviewVideoAdapter } from "@/features/preview";

import { PlaybackContext } from "../contexts/playback-context";
import { PlaybackController, type PlaybackDriver } from "../controllers/playback-controller";

function PlaybackProvider({ children }: { children: ReactNode }) {
  const source = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const sourceLoadToken = useAppSelector(selectSourceLoadToken);
  const audio = useAudioPlaybackAdapter();
  const video = usePreviewVideoAdapter();
  const driver = useMemo<PlaybackDriver>(() => ({ audio, video }), [audio, video]);
  const mediaSessionId = source ? sourceLoadToken : null;
  const [controller] = useState(() => new PlaybackController());

  useLayoutEffect(() => {
    controller.attach(mediaSessionId, driver, media?.durationMicros ?? 0);
  }, [controller, driver, media?.durationMicros, mediaSessionId]);

  useEffect(() => () => controller.dispose(), [controller]);

  return <PlaybackContext.Provider value={controller}>{children}</PlaybackContext.Provider>;
}

export { PlaybackProvider };
