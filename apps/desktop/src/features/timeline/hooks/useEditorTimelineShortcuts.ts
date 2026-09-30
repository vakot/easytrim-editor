import { type RefObject,useEffect, useRef } from "react";

import type { TrimBoundary } from "@/domain/trim";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

import {
  editorShortcutFromEvent,
  type FrameShuttleDirection,
  shortcutDispositionFromEvent,
} from "../lib/editor-shortcuts";

interface EditorTimelineShortcutActions {
  enabled: boolean;
  onSetSegmentBoundary: (boundary: TrimBoundary, origin?: DiagnosticOrigin) => void;
  onShuttleEnd: (origin?: DiagnosticOrigin) => void;
  onShuttleStart: (direction: FrameShuttleDirection, origin?: DiagnosticOrigin) => void;
  onStepFrame: (direction: -1 | 1, origin?: DiagnosticOrigin) => void;
  onTogglePlayback: (origin?: DiagnosticOrigin) => void;
}

function useEditorTimelineShortcuts(
  actions: EditorTimelineShortcutActions,
  isTimelineInteractionActiveRef: RefObject<boolean>,
): void {
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    let heldDirection: FrameShuttleDirection | 0 = 0;
    let shuttleStarted = false;

    function releaseHeldFrameShortcut(origin: DiagnosticOrigin) {
      if (shuttleStarted) actionsRef.current.onShuttleEnd(origin);
      heldDirection = 0;
      shuttleStarted = false;
    }

    function handleEditorShortcut(event: globalThis.KeyboardEvent) {
      if (isApplicationInteractionBlocked() || isTimelineInteractionActiveRef.current) return;
      const actions = actionsRef.current;
      const shortcut = editorShortcutFromEvent(event);
      if (!actions.enabled || !shortcut) return;
      if (event.defaultPrevented || shortcutDispositionFromEvent(event) !== "timeline") return;

      event.preventDefault();
      event.stopPropagation();
      const origin = { type: "hotkey" as const, id: event.key };
      const direction = shortcut === "previous-frame" ? -1 : shortcut === "next-frame" ? 1 : 0;

      if (direction !== 0) {
        if (event.repeat) {
          if (heldDirection === direction && !shuttleStarted) {
            shuttleStarted = true;
            actions.onShuttleStart(direction, origin);
          }
          return;
        }
        if (heldDirection !== 0) releaseHeldFrameShortcut(origin);
        heldDirection = direction;
        actions.onStepFrame(direction, origin);
        return;
      }

      if (event.repeat) return;
      if (heldDirection !== 0) releaseHeldFrameShortcut(origin);
      if (shortcut === "toggle-playback") actions.onTogglePlayback(origin);
      if (shortcut === "set-segment-start") actions.onSetSegmentBoundary("start", origin);
      if (shortcut === "set-segment-end") actions.onSetSegmentBoundary("end", origin);
    }

    function handleEditorShortcutRelease(event: globalThis.KeyboardEvent) {
      const shortcut = editorShortcutFromEvent(event);
      const direction = shortcut === "previous-frame" ? -1 : shortcut === "next-frame" ? 1 : 0;
      if (direction === 0 || direction !== heldDirection) return;
      event.preventDefault();
      event.stopPropagation();
      releaseHeldFrameShortcut({ type: "hotkey", id: event.key });
    }

    function handleWindowBlur() {
      if (heldDirection !== 0) releaseHeldFrameShortcut({ type: "internal", id: "window-blur" });
    }

    window.addEventListener("keydown", handleEditorShortcut, true);
    window.addEventListener("keyup", handleEditorShortcutRelease, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleEditorShortcut, true);
      window.removeEventListener("keyup", handleEditorShortcutRelease, true);
      window.removeEventListener("blur", handleWindowBlur);
      if (shuttleStarted) actionsRef.current.onShuttleEnd({ type: "internal", id: "unmount" });
    };
  }, [isTimelineInteractionActiveRef]);
}

export { useEditorTimelineShortcuts };
