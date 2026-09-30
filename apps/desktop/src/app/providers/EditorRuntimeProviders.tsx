import type { ReactNode } from "react";

import { AudioPlaybackProvider } from "@/features/audio";
import { PreviewPlaybackProvider } from "@/features/preview";
import { TimelinePlaybackProvider } from "@/features/timeline";

function EditorRuntimeProviders({ children }: { children: ReactNode }) {
  return (
    <PreviewPlaybackProvider>
      <AudioPlaybackProvider>
        <TimelinePlaybackProvider>{children}</TimelinePlaybackProvider>
      </AudioPlaybackProvider>
    </PreviewPlaybackProvider>
  );
}

export { EditorRuntimeProviders };
