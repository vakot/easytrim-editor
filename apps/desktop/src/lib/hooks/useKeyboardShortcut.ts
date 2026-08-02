import { useEffect, useRef } from "react";

import { isApplicationDialogOpen, isEditableTarget } from "@/lib/hotkeys";

type KeyboardPredicate = (event: KeyboardEvent) => boolean;
type KeyboardHandler = (event: KeyboardEvent) => void | Promise<void>;

export function useKeyboardShortcut(predicate: KeyboardPredicate, handler: KeyboardHandler) {
  const predicateRef = useRef(predicate);
  const handlerRef = useRef(handler);

  useEffect(() => {
    predicateRef.current = predicate;
    handlerRef.current = handler;
  }, [handler, predicate]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !predicateRef.current(event) ||
        event.altKey ||
        event.metaKey ||
        isApplicationDialogOpen() ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void handlerRef.current(event);
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);
}
