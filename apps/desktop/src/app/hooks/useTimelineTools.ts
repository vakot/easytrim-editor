import { useCallback } from "react";

import { useEditorViewState } from "@/app/hooks/useEditorViewState";
import type { EditorToolState } from "@/app/editor-view-state-context";

export function useTimelineTools() {
  const { tools, setTools, resetTools } = useEditorViewState();

  const update = useCallback(
    (changes: Partial<EditorToolState>) => setTools({ ...tools, ...changes }),
    [setTools, tools],
  );

  return {
    ...tools,
    playbackSpeed: tools.playbackSpeed,
    setPlaybackSpeed: (playbackSpeed: EditorToolState["playbackSpeed"]) =>
      update({ playbackSpeed }),
    toggleSafeTrimFollowing: () =>
      update({ safeTrimFollowingEnabled: !tools.safeTrimFollowingEnabled }),
    toggleLoopPlayback: () => update({ loopPlaybackEnabled: !tools.loopPlaybackEnabled }),
    toggleSegmentPlayback: () => update({ segmentPlaybackEnabled: !tools.segmentPlaybackEnabled }),
    reset: resetTools,
  };
}
