import { isAnyOf } from "@reduxjs/toolkit";

import {
  createEditorSnapshotFromState,
  historyProjection,
} from "@/app/store/integration/editor-snapshot";
import {
  audioTrackDefaultChanged,
  audioTrackFiltersApplied,
  audioTrackMetadataChanged,
  audioTrackToggled,
  audioTrackVolumeChanged,
} from "@/app/store/slices/audio-slice";
import { chapterAdded, chapterDeleted, chapterUpdated } from "@/app/store/slices/chapters-slice";
import { cropChanged, flipToggled, rotationChanged } from "@/app/store/slices/crop-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { historyChangesCaptured } from "@/app/store/slices/workspace-history-slice";
import { identifyHistoryChanges } from "@/domain/workspace-history";

import { listenerMiddleware } from "../listener-middleware";

const editActions = [
  trimChanged,
  cropChanged,
  rotationChanged,
  flipToggled,
  audioTrackToggled,
  audioTrackDefaultChanged,
  audioTrackMetadataChanged,
  audioTrackVolumeChanged,
  audioTrackFiltersApplied,
  chapterAdded,
  chapterUpdated,
  chapterDeleted,
] as const;

const labels: Record<string, string> = {
  "trim/trimChanged": "Adjust trim",
  "crop/cropChanged": "Change crop",
  "crop/rotationChanged": "Rotate video",
  "crop/flipToggled": "Flip video",
  "audio/audioTrackToggled": "Change audio track",
  "audio/audioTrackDefaultChanged": "Set default audio track",
  "audio/audioTrackMetadataChanged": "Edit audio track metadata",
  "audio/audioTrackVolumeChanged": "Adjust audio volume",
  "audio/audioTrackFiltersApplied": "Edit audio filters",
  "chapters/chapterAdded": "Add chapter",
  "chapters/chapterUpdated": "Edit chapter",
  "chapters/chapterDeleted": "Delete chapter",
};

listenerMiddleware.startListening({
  matcher: isAnyOf(...editActions),
  effect: (action, api) => {
    if (api.getState().workspaceHistory.replaying) return;
    const beforeState = api.getOriginalState();
    const activeId = beforeState.editingInstances.activeInstanceId;
    const source = beforeState.source.source;
    if (!activeId || !source) return;
    const beforeSnapshot = createEditorSnapshotFromState(beforeState, source);
    if (!beforeSnapshot) return;
    const current = api.getState();
    if (
      current.workspaceHistory.replaying ||
      current.editingInstances.activeInstanceId !== activeId
    )
      return;
    const afterSnapshot = createEditorSnapshotFromState(current, current.source.source ?? source);
    if (!afterSnapshot) return;
    const target = { kind: "instance" as const, instanceId: activeId, sourceId: source.sourcePath };
    const changes = identifyHistoryChanges(
      target,
      historyProjection(beforeSnapshot),
      historyProjection(afterSnapshot),
    );

    if (!changes.length) return;
    api.dispatch(
      historyChangesCaptured({
        changes,
        metadata: {
          id: crypto.randomUUID(),
          label: labels[action.type] ?? "Edit workspace",
          timestamp: Date.now(),
        },
      }),
    );
  },
});
