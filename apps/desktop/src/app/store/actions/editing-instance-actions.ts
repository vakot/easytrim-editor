import { createAction } from "@reduxjs/toolkit";

import type { EditingInstanceId } from "@/domain/editing-instance";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import type { MediaInfo } from "@/lib/tauri/media.types";

export const editingInstanceActivated = createAction<{
  id: EditingInstanceId;
  loadToken: number;
  media?: MediaInfo;
  snapshot: EditorSnapshot;
}>("editingInstance/activated");
