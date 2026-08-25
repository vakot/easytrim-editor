import { useState } from "react";

import type { ContextMenuId, MenuNavigation } from "../types";

export function useContextMenuNavigation(): Record<ContextMenuId, MenuNavigation> {
  const [openMenu, setOpenMenu] = useState<ContextMenuId | null>(null);
  const [switchingMenu, setSwitchingMenu] = useState<ContextMenuId | null>(null);

  const createNavigation = (id: ContextMenuId): MenuNavigation => ({
    open: openMenu === id,
    onOpenChange: (isOpen) => {
      if (!isOpen && switchingMenu === id) {
        setSwitchingMenu(null);
        return;
      }

      if (isOpen) setSwitchingMenu(null);
      setOpenMenu((current) => {
        if (isOpen) return id;
        return current === id ? null : current;
      });
    },
    onTriggerPointerEnter: () => {
      if (openMenu !== null && openMenu !== id) {
        setSwitchingMenu(id);
        setOpenMenu(id);
      }
    },
  });

  return {
    file: createNavigation("file"),
    view: createNavigation("view"),
    queue: createNavigation("queue"),
    settings: createNavigation("settings"),
    help: createNavigation("help"),
  };
}
