import { type ReactNode, useEffect, useLayoutEffect, useMemo, useState } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { useAudioPlaybackAdapter } from "@/features/audio";
import { usePreviewVideoAdapter } from "@/features/preview";

import { PlaybackContext } from "./contexts/playback-context";
import { PlaybackController, type PlaybackDriver } from "./playback-controller";

function PlaybackProvider({ children }: { children: ReactNode }) {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const source = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const audio = useAudioPlaybackAdapter();
  const video = usePreviewVideoAdapter();
  const driver = useMemo<PlaybackDriver>(() => ({ audio, video }), [audio, video]);

  const sessionKey = JSON.stringify([
    activeInstanceId,
    source?.sourcePath ?? null,
    video.sessionKey,
    media?.durationMicros ?? 0,
  ]);

  return (
    <PlaybackSessionProvider
      driver={driver}
      durationMicros={media?.durationMicros ?? 0}
      key={sessionKey}
    >
      {children}
    </PlaybackSessionProvider>
  );
}

function PlaybackSessionProvider({
  children,
  driver,
  durationMicros,
}: {
  children: ReactNode;
  driver: PlaybackDriver;
  durationMicros: number;
}) {
  const [controller] = useState(() => new PlaybackController(driver, durationMicros));

  useLayoutEffect(() => {
    controller.updateDriver(driver);
  }, [controller, driver]);

  useEffect(() => controller.connect(), [controller]);

  return <PlaybackContext.Provider value={controller}>{children}</PlaybackContext.Provider>;
}

export { PlaybackProvider };
