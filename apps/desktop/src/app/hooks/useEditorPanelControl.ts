import { useCallback } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  panelCollapseToggled,
  panelVisibilityChanged,
  selectEditorPanel,
  type EditorPanelId,
} from "@/app/store/slices/editor-layout-slice";

type EditorPanelToggleMode = "collapse" | "visibility";

interface UseEditorPanelControlResult {
  active: boolean;
  setActive: (active: boolean) => void;
  toggle: () => void;
}

function useEditorPanelControl(
  panelId: EditorPanelId,
  mode: EditorPanelToggleMode,
): UseEditorPanelControlResult {
  const dispatch = useAppDispatch();
  const panel = useAppSelector((state) => selectEditorPanel(state, panelId));
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

export { useEditorPanelControl };
export type { EditorPanelToggleMode };
