import { useCallback, useEffect, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import {
  canSetTrimBoundaryAtPlayhead,
  setTrimBoundaryAtPlayhead,
  type TrimBoundary,
  type TrimRange,
} from "@/domain/trim";
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

function useTimelineEditingCommands({
  currentPlayheadMicrosRef,
  onScrubEnd,
  onScrubStart,
  trimInteractionActiveRef,
  trimRef,
}: {
  currentPlayheadMicrosRef: { current: number };
  onScrubEnd: () => void;
  onScrubStart: () => void;
  trimInteractionActiveRef: { current: boolean };
  trimRef: { current: TrimRange };
}) {
  const dispatch = useAppDispatch();
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;
  const trimCommitFrameRef = useRef<number | null>(null);
  const pendingTrimCommitRef = useRef<TrimRange | null>(null);

  const flushTrimCommit = useCallback(() => {
    if (trimCommitFrameRef.current !== null) cancelAnimationFrame(trimCommitFrameRef.current);
    trimCommitFrameRef.current = null;
    const pendingTrim = pendingTrimCommitRef.current;
    pendingTrimCommitRef.current = null;
    if (pendingTrim && sourcePath) dispatch(trimChanged({ trim: pendingTrim }));
  }, [dispatch, sourcePath]);

  const queueTrimCommit = useCallback(
    (nextTrim: TrimRange) => {
      pendingTrimCommitRef.current = nextTrim;
      if (trimCommitFrameRef.current !== null) return;
      trimCommitFrameRef.current = requestAnimationFrame(() => {
        trimCommitFrameRef.current = null;
        const pendingTrim = pendingTrimCommitRef.current;
        pendingTrimCommitRef.current = null;
        if (pendingTrim && sourcePath) dispatch(trimChanged({ trim: pendingTrim }));
      });
    },
    [dispatch, sourcePath],
  );

  const onSetSegmentBoundary = useCallback(
    (boundary: TrimBoundary, origin: DiagnosticOrigin = { type: "internal" }) => {
      diagnostics.action("timeline.trim-boundary.requested", origin, { boundary });
      if (!sourcePath) {
        diagnostics.event("timeline.trim-boundary.ignored", {
          data: { boundary, reason: "source_unavailable" },
          origin,
          result: "ignored",
        });
        return;
      }

      const currentMicros = currentPlayheadMicrosRef.current;
      if (!canSetTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros)) {
        diagnostics.event("timeline.trim-boundary.ignored", {
          data: { boundary, reason: "outside_trim_range" },
          origin,
          result: "ignored",
        });
        return;
      }

      const nextTrim = setTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros);
      trimRef.current = nextTrim;
      flushTrimCommit();
      dispatch(trimChanged({ trim: nextTrim }));
      diagnostics.event("timeline.trim-boundary.changed", {
        data: { boundary, micros: currentMicros },
        origin,
      });
    },
    [currentPlayheadMicrosRef, dispatch, flushTrimCommit, sourcePath, trimRef],
  );

  const onTrimBoundaryChange = useCallback(
    (_boundary: TrimBoundary, nextTrim: TrimRange) => {
      trimRef.current = nextTrim;
      queueTrimCommit(nextTrim);
    },
    [queueTrimCommit, trimRef],
  );

  const onSegmentMove = useCallback(
    (nextTrim: TrimRange) => {
      trimRef.current = nextTrim;
      queueTrimCommit(nextTrim);
    },
    [queueTrimCommit, trimRef],
  );

  const beginTrimDrag = useCallback(() => {
    trimInteractionActiveRef.current = true;
    onScrubStart();
  }, [onScrubStart, trimInteractionActiveRef]);

  const finishTrimDrag = useCallback(() => {
    flushTrimCommit();
    dispatch(commitActiveEditingInstanceDraft());
    onScrubEnd();
  }, [dispatch, flushTrimCommit, onScrubEnd]);

  useEffect(
    () => () => {
      if (trimCommitFrameRef.current !== null) cancelAnimationFrame(trimCommitFrameRef.current);
      trimCommitFrameRef.current = null;
      pendingTrimCommitRef.current = null;
    },
    [],
  );

  return {
    onSegmentDragEnd: finishTrimDrag,
    onSegmentDragStart: beginTrimDrag,
    onSegmentMove,
    onSetSegmentBoundary,
    onTrimBoundaryChange,
    onTrimDragEnd: finishTrimDrag,
    onTrimDragStart: beginTrimDrag,
  };
}

export { useTimelineEditingCommands };
