import { useEffect, useRef, useState } from "react";

import { useAppDispatch, useAppSelector, useAppStore } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectFrameIndex, selectSourceLoadToken } from "@/app/store/slices/source-slice";
import { selectTrim, trimChanged } from "@/app/store/slices/trim-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { createTrimFrameAdapter, type TrimFrames, type TrimHandle } from "@/domain/trim-frames";
import { usePlaybackActions, usePlaybackIsPlaying } from "@/features/playback";

function useTimelineTrimEditing() {
  const frameIndex = useAppSelector(selectFrameIndex);
  const framesCount = frameIndex.count;
  const trim = useAppSelector(selectTrim);
  const instanceId = useAppSelector(selectActiveInstanceId);
  const loadToken = useAppSelector(selectSourceLoadToken);
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { pause, play } = usePlaybackActions();
  const isPlaying = usePlaybackIsPlaying();
  const adapter = createTrimFrameAdapter(frameIndex);

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
  const active = draft;
  const isCurrent = active?.instanceId === instanceId && active?.loadToken === loadToken;
  const range =
    (isCurrent && draft?.range) || (trim ? adapter.fromTrim(trim) : { start: 0, end: 0 });

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
    if (!trim || framesCount === 0) return;
    interaction.current = { instanceId, loadToken, handle, range, resume: isPlaying };
    pause();
    setDraft(interaction.current);
  }

  function change(handle: TrimHandle, frame: number) {
    const current = interaction.current;
    const currentSource = current?.instanceId === instanceId && current?.loadToken === loadToken;
    if (current && !currentSource) return;
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

  /** In marks `frame` as the first included frame; Out marks it as the last included frame. */
  function markFrame(handle: "start" | "end", frame: number) {
    if (!trim) return;
    const base = { ...range };
    if (handle === "start" && frame > base.end) base.end = adapter.lastFrame;
    if (handle === "end" && frame < base.start) base.start = 0;
    commit(adapter.edit(base, handle, frame));
  }

  return {
    range,
    bounds: adapter.bounds(range),
    enabled: !!trim && framesCount > 0,
    dragging: isCurrent ? active?.handle : undefined,
    begin,
    change,
    finish,
    markFrame,
  };
}

export { useTimelineTrimEditing };
