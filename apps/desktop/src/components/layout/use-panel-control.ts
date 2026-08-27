import { useCallback } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  panelCollapseToggled,
  panelVisibilityChanged,
  selectPanel,
  type PanelId,
} from "@/app/store/slices/panel-layout-slice";

type PanelToggleMode = "collapse" | "visibility";

interface UsePanelControlResult {
  active: boolean;
  setActive: (active: boolean) => void;
  toggle: () => void;
}

function usePanelControl(panelId: PanelId, mode: PanelToggleMode): UsePanelControlResult {
  const dispatch = useAppDispatch();
  const panel = useAppSelector((state) => selectPanel(state, panelId));
  const active = mode === "visibility" ? panel.visible : panel.visible && !panel.collapsed;
  const setActive = useCallback(
    (nextActive: boolean) => {
      if (mode === "visibility") {
        if (nextActive !== panel.visible) {
          dispatch(panelVisibilityChanged({ panelId, visible: nextActive }));
        }
        return;
      }

      if (!panel.visible) {
        if (nextActive) dispatch(panelVisibilityChanged({ panelId, visible: true }));
        return;
      }

      const isExpanded = !panel.collapsed;
      if (nextActive !== isExpanded) dispatch(panelCollapseToggled(panelId));
    },
    [dispatch, mode, panel.collapsed, panel.visible, panelId],
  );
  const toggle = useCallback(() => setActive(!active), [active, setActive]);

  return { active, setActive, toggle };
}

export { usePanelControl };
export type { PanelToggleMode };
