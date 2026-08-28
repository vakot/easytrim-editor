import { useCallback, useRef, useState } from "react";

import type { ContextMenuId, MenuNavigation } from "../types";

export function useContextMenuNavigation(): Record<ContextMenuId, MenuNavigation> {
  const [openMenu, setOpenMenu] = useState<ContextMenuId | null>(null);
  // Radix can report a close while a controlled root is being switched by hover.
  // Keep this handoff marker outside React state so stale callbacks cannot consume a real close.
  const switchingMenuRef = useRef<ContextMenuId | null>(null);
  const handleOpenChange = useCallback((id: ContextMenuId, isOpen: boolean) => {
    if (!isOpen && switchingMenuRef.current === id) {
      switchingMenuRef.current = null;
      return;
    }

    if (isOpen) switchingMenuRef.current = null;
    setOpenMenu((current) => {
      if (isOpen) return id;
      return current === id ? null : current;
    });
  }, []);
  const handleTriggerPointerEnter = useCallback(
    (id: ContextMenuId) => {
      if (openMenu !== null && openMenu !== id) {
        switchingMenuRef.current = id;
        setOpenMenu(id);
      }
    },
    [openMenu],
  );
  const handleTriggerPointerLeave = useCallback((id: ContextMenuId) => {
    if (switchingMenuRef.current === id) switchingMenuRef.current = null;
  }, []);

  const createNavigation = (id: ContextMenuId): MenuNavigation => ({
    open: openMenu === id,
    onOpenChange: (isOpen) => handleOpenChange(id, isOpen),
    onTriggerPointerEnter: () => handleTriggerPointerEnter(id),
    onTriggerPointerLeave: () => handleTriggerPointerLeave(id),
  });

  return {
    file: createNavigation("file"),
    view: createNavigation("view"),
    queue: createNavigation("queue"),
    settings: createNavigation("settings"),
    help: createNavigation("help"),
  };
}
