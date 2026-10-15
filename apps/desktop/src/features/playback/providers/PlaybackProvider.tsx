import { type ReactNode, useEffect, useLayoutEffect, useMemo, useState } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectPlaybackSpeed } from "@/app/store/slices/playback-controls-slice";
import {
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/preferences-slice";
import {
  selectFrameIndex,
  selectSourceLoadToken,
  selectSourceMedia,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { playbackRange } from "@/domain/playback";
import { useAudioPlaybackAdapter } from "@/features/audio";
import { usePreviewVideoAdapter } from "@/features/preview";

import { PlaybackContext } from "../contexts/playback-context";
import { PlaybackController, type PlaybackDriver } from "../controllers/playback-controller";

function PlaybackProvider({ children }: { children: ReactNode }) {
  const source = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const loop = useAppSelector(selectLoopPlaybackEnabled);
  const segmentEnabled = useAppSelector(selectSegmentPlaybackEnabled);
  const trim = useAppSelector(selectTrim);
  const sourceLoadToken = useAppSelector(selectSourceLoadToken);
  const playbackSpeed = useAppSelector(selectPlaybackSpeed);
  const audio = useAudioPlaybackAdapter();
  const video = usePreviewVideoAdapter();
  const driver = useMemo<PlaybackDriver>(() => ({ audio, video }), [audio, video]);
  const mediaSessionId = source ? sourceLoadToken : null;
  const [controller] = useState(() => new PlaybackController());

  useLayoutEffect(() => {
    controller.attach(mediaSessionId, driver, media?.durationMicros ?? 0);
  }, [controller, driver, media?.durationMicros, mediaSessionId]);

  const segmentStartMicros = trim?.startMicros;
  const segmentEndMicros = trim?.endMicros;
  const durationMicros = media?.durationMicros ?? 0;
  const frameIndex = useAppSelector(selectFrameIndex);

  useLayoutEffect(() => {
    controller.setOptions({
      frameIndex,
      loop,
      segment:
        segmentEnabled && segmentStartMicros !== undefined && segmentEndMicros !== undefined
          ? playbackRange(durationMicros, segmentStartMicros, segmentEndMicros, true)
          : null,
    });
  }, [
    controller,
    durationMicros,
    frameIndex,
    loop,
    segmentEnabled,
    segmentEndMicros,
    segmentStartMicros,
  ]);

  useLayoutEffect(() => {
    controller.setPlaybackRate(playbackSpeed);
  }, [controller, playbackSpeed]);

  useEffect(() => () => controller.dispose(), [controller]);

  return <PlaybackContext.Provider value={controller}>{children}</PlaybackContext.Provider>;
}

export { PlaybackProvider };
