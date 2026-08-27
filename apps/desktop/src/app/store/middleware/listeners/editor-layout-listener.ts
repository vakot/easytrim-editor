import { resetEditorPanelSizes } from "@/app/editor-layout-runtime";
import { editorPanelsResetToDefault } from "@/app/store/slices/editor-layout-slice";

import { listenerMiddleware } from "../listener-middleware";

listenerMiddleware.startListening({
  actionCreator: editorPanelsResetToDefault,
  effect: (action) =>
    resetEditorPanelSizes(
      action.payload.filter((request) => request.resetSize).map((request) => request.panelId),
    ),
});
