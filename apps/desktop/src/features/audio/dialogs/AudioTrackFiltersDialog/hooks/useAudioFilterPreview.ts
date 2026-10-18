import { useEffect, useRef, useState } from "react";

import { useAppDispatch } from "@/app/store/redux-hooks";
import {
  audioFilterPreviewChanged,
  audioFilterPreviewEnded,
  audioFilterPreviewStarted,
} from "@/app/store/slices/audio-slice";

import { type AudioFiltersDraft, isAudioFiltersDraftValid } from "../lib/audio-filters-draft";

/** Coalesces bursts of edits, such as typing or dragging a slider, into one published draft. */
const PREVIEW_PUBLISH_DELAY_MS = 120;
/** Continuous edits are still heard at least this often. */
const PREVIEW_PUBLISH_MAX_DELAY_MS = 300;

/**
 * Auditions the dialog's draft through playback while the dialog is open. The latest valid draft
 * is published once edits settle, and at a bounded interval during continuous edits; an invalid
 * draft keeps the last valid one audible. Closing the dialog ends the preview.
 */
function useAudioFilterPreview(streamIndex: number, draft: AudioFiltersDraft) {
  const dispatch = useAppDispatch();
  const [id] = useState(() => crypto.randomUUID());
  const pendingSince = useRef<number | null>(null);

  useEffect(() => {
    dispatch(audioFilterPreviewStarted({ id, streamIndex }));
    return () => {
      dispatch(audioFilterPreviewEnded({ id }));
    };
  }, [dispatch, id, streamIndex]);

  const valid = isAudioFiltersDraftValid(draft);
  const { filters } = draft;
  useEffect(() => {
    if (!valid) return;
    const now = performance.now();
    pendingSince.current ??= now;
    const delay = Math.min(
      PREVIEW_PUBLISH_DELAY_MS,
      Math.max(0, pendingSince.current + PREVIEW_PUBLISH_MAX_DELAY_MS - now),
    );

    const timer = window.setTimeout(() => {
      pendingSince.current = null;
      dispatch(audioFilterPreviewChanged({ filters, id, syncOffset: draft.syncOffset }));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [dispatch, draft.syncOffset, filters, id, valid]);
}

export { useAudioFilterPreview };
