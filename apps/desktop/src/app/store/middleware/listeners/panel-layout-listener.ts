import { resetPanelSizes } from "@/app/panel-layout-runtime";
import { panelsResetToDefault } from "@/app/store/slices/panel-layout-slice";

import { listenerMiddleware } from "../listener-middleware";

listenerMiddleware.startListening({
  actionCreator: panelsResetToDefault,
  effect: (action) =>
    resetPanelSizes(
      action.payload.filter((request) => request.resetSize).map((request) => request.panelId),
    ),
});
