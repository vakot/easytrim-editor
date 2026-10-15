import { useEffect, useRef, useState } from "react";

import { useAppSelector, useAppStore } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectFrameIndex, selectSourceLoadToken } from "@/app/store/slices/source-slice";
import { nearestBoundaryMicros } from "@/domain/frame-index";
import type { TrimRange } from "@/domain/trim";
import { createTrimFrameAdapter, type TrimFrames, type TrimHandle } from "@/domain/trim-frames";
import { type PlaybackHoldRelease, usePlaybackActions } from "@/features/playback";

/**
 * Editing of a time range on the timeline. Every boundary lands on a real frame boundary of the
 * source; the frame adapter keeps the minimum range length. A drag stays a local draft and reaches
 * `onCommit` when it ends; other edits commit at once. Edits never outlive their source.
 */
function useTimelineRangeEditing(value: TrimRange | null, onCommit: (range: TrimRange) => void) {
  const index = useAppSelector(selectFrameIndex);
  const instanceId = useAppSelector(selectActiveInstanceId);
  const loadToken = useAppSelector(selectSourceLoadToken);
  const store = useAppStore();
  const { holdPlayback } = usePlaybackActions();
  const adapter = createTrimFrameAdapter(index);

  type Interaction = {
    handle: TrimHandle;
    instanceId: string | null;
    loadToken: number;
    range: TrimFrames;
    /** Ends the playback hold taken for the drag, resuming a run it interrupted. */
    releasePlayback: PlaybackHoldRelease;
  };
  const [draft, setDraft] = useState<Interaction | null>(null);
  const interaction = useRef<Interaction | null>(null);
  useEffect(
    () => () => {
      // The drag is abandoned with its source; the next source must not start playing.
      interaction.current?.releasePlayback({ resume: false });
      interaction.current = null;
    },
    [instanceId, loadToken],
  );
  const isCurrent = draft?.instanceId === instanceId && draft?.loadToken === loadToken;
  const range =
    (isCurrent && draft?.range) || (value ? adapter.fromTrim(value) : { start: 0, end: 0 });

  /** The boundary index nearest `micros`: frame `k` starts at boundary `k`; the end is `count`. */
  const boundaryAt = (micros: number) => {
    const boundary = nearestBoundaryMicros(index, micros);
    return boundary >= index.endMicros ? index.count : index.frameAt(boundary);
  };

  function commit(next: TrimFrames) {
    const state = store.getState();
    if (
      !value ||
      selectActiveInstanceId(state) !== instanceId ||
      selectSourceLoadToken(state) !== loadToken
    )
      return;
    const nextValue = adapter.toTrim(next);
    if (nextValue.startMicros === value.startMicros && nextValue.endMicros === value.endMicros)
      return;
    onCommit(nextValue);
  }

  function begin(handle: TrimHandle) {
    if (!value || index.count === 0) return;
    interaction.current?.releasePlayback({ resume: false });
    interaction.current = {
      instanceId,
      loadToken,
      handle,
      range,
      releasePlayback: holdPlayback(),
    };
    setDraft(interaction.current);
  }

  /** Moves a boundary to `micros`; for "move", `micros` is the range's new start. */
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
    const currentSource =
      selectActiveInstanceId(state) === current.instanceId &&
      selectSourceLoadToken(state) === current.loadToken;

    if (currentSource) commit(current.range);
    current.releasePlayback({ resume: currentSource });
  }

  /** Moves a boundary, or the whole range, by one real frame. */
  function step(handle: TrimHandle, direction: -1 | 1) {
    if (!value || index.count === 0) return;
    const frame = (handle === "end" ? range.end : range.start) + direction;
    commit(adapter.edit(range, handle, frame));
  }

  /** In starts the range at the frame on screen; Out ends it after that frame. */
  function mark(handle: "start" | "end", positionMicros: number) {
    if (!value || index.count === 0) return;
    const frame = index.frameAt(positionMicros);
    const base = { ...range };
    if (handle === "start" && frame > base.end) base.end = adapter.lastFrame;
    if (handle === "end" && frame < base.start) base.start = 0;
    commit(adapter.edit(base, handle, frame));
  }

  const bounds = adapter.bounds(range);
  return {
    enabled: !!value && index.count > 0,
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

export { useTimelineRangeEditing };
