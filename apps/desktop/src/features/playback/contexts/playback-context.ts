import { createContext, useContext } from "react";

import type { PlaybackController } from "../controllers/playback-controller";

const PlaybackContext = createContext<PlaybackController | null>(null);

function usePlaybackController() {
  const controller = useContext(PlaybackContext);
  if (!controller) throw new Error("Playback must be used within PlaybackProvider.");
  return controller;
}

export { PlaybackContext, usePlaybackController };
