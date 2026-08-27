import { resetEditorLayoutRuntime } from "@/app/editor-layout-runtime";
import { editorLayoutReset } from "@/app/store/slices/editor-layout-slice";

import { listenerMiddleware } from "../listener-middleware";

listenerMiddleware.startListening({
  actionCreator: editorLayoutReset,
  effect: () => resetEditorLayoutRuntime(),
});
