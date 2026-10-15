import { useEffect, useRef, useState } from "react";

import { useAppDispatch, useAppSelector, useAppStore } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectFrameIndex, selectSourceLoadToken } from "@/app/store/slices/source-slice";
import { selectTrim, trimChanged } from "@/app/store/slices/trim-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { nearestBoundaryMicros } from "@/domain/frame-index";
import { createTrimFrameAdapter, type TrimFrames, type TrimHandle } from "@/domain/trim-frames";
import { usePlaybackActions, usePlaybackIsPlaying } from "@/features/playback";

/**
 * Trim editing in time. Every boundary lands on a real frame boundary of the source; the frame
 * adapter keeps the minimum selection length and converts to the exported time range.
 */
function useTimelineTrimEditing() {
  const index = useAppSelector(selectFrameIndex);
  const trim = useAppSelector(selectTrim);
  const instanceId = useAppSelector(selectActiveInstanceId);
  const loadToken = useAppSelector(selectSourceLoadToken);
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { pause, play } = usePlaybackActions();
  const isPlaying = usePlaybackIsPlaying();
  const adapter = createTrimFrameAdapter(index);

  type Interaction = {
    handle: TrimHandle;
    instanceId: string | null;
    loadToken: number;
    range: TrimFrames;
    resume: boolean;
  };
  const [draft, setDraft] = useState<Interaction | null>(null);
  const interaction = useRef<Interaction | null>(null);
  useEffect(() => {
    interaction.current = null;
  }, [instanceId, loadToken]);
  const isCurrent = draft?.instanceId === instanceId && draft?.loadToken === loadToken;
  const range =
    (isCurrent && draft?.range) || (trim ? adapter.fromTrim(trim) : { start: 0, end: 0 });

  /** The boundary index nearest `micros`: frame `k` starts at boundary `k`; the end is `count`. */
  const boundaryAt = (micros: number) => {
    const boundary = nearestBoundaryMicros(index, micros);
    return boundary >= index.endMicros ? index.count : index.frameAt(boundary);
  };

  function commit(next: TrimFrames) {
    const state = store.getState();
    if (
      !trim ||
      selectActiveInstanceId(state) !== instanceId ||
      selectSourceLoadToken(state) !== loadToken
    )
      return;
    const value = adapter.toTrim(next);
    if (value.startMicros === trim.startMicros && value.endMicros === trim.endMicros) return;
    dispatch(trimChanged({ trim: value }));
    dispatch(commitActiveEditingInstanceDraft());
  }

  function begin(handle: TrimHandle) {
    if (!trim || index.count === 0) return;
    interaction.current = { instanceId, loadToken, handle, range, resume: isPlaying };
    pause();
    setDraft(interaction.current);
  }

  /** Moves a boundary to `micros`; for "move", `micros` is the selection's new start. */
  function change(handle: TrimHandle, micros: number) {
    const current = interaction.current;
    const currentSource = current?.instanceId === instanceId && current?.loadToken === loadToken;
    if (current && !currentSource) return;
    const frame = handle === "end" ? boundaryAt(micros) - 1 : boundaryAt(micros);
    const next = adapter.edit(currentSource && current ? current.range : range, handle, frame);
    if (current && currentSource) {
      interaction.current = { ...current, range: next };
      setDraft(interaction.current);
    } else commit(next);
  }

  function finish() {
    const current = interaction.current;
    if (!current) return;
    interaction.current = null;
    setDraft(null);
    const state = store.getState();
    if (
      selectActiveInstanceId(state) !== current.instanceId ||
      selectSourceLoadToken(state) !== current.loadToken
    )
      return;
    commit(current.range);
    if (current.resume) play();
  }

  /** Moves a boundary, or the whole selection, by one real frame. */
  function step(handle: TrimHandle, direction: -1 | 1) {
    if (!trim || index.count === 0) return;
    const frame = (handle === "end" ? range.end : range.start) + direction;
    commit(adapter.edit(range, handle, frame));
  }

  /** In starts the selection at the frame on screen; Out ends it after that frame. */
  function mark(handle: "start" | "end", positionMicros: number) {
    if (!trim || index.count === 0) return;
    const frame = index.frameAt(positionMicros);
    const base = { ...range };
    if (handle === "start" && frame > base.end) base.end = adapter.lastFrame;
    if (handle === "end" && frame < base.start) base.start = 0;
    commit(adapter.edit(base, handle, frame));
  }

  const bounds = adapter.bounds(range);
  return {
    enabled: !!trim && index.count > 0,
    dragging: isCurrent ? draft?.handle : undefined,
    startMicros: index.startOf(range.start),
    endMicros: index.startOf(range.end + 1),
    /** The latest start for the current end, and the earliest end for the current start. */
    maxStartMicros: index.startOf(bounds.maxStart),
    minEndMicros: index.startOf(bounds.minEnd + 1),
    begin,
    change,
    finish,
    mark,
    step,
  };
}

export { useTimelineTrimEditing };
