import type { ReactNode } from "react";

import { AudioPlaybackProvider } from "@/features/audio";
import { PlaybackProvider } from "@/features/playback";
import { PreviewPlaybackProvider } from "@/features/preview";

function EditorRuntimeProviders({ children }: { children: ReactNode }) {
  return (
    <PreviewPlaybackProvider>
      <AudioPlaybackProvider>
        <PlaybackProvider>{children}</PlaybackProvider>
      </AudioPlaybackProvider>
    </PreviewPlaybackProvider>
  );
}

export { EditorRuntimeProviders };
