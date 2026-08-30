import { createAction } from "@reduxjs/toolkit";

import type { EditorSnapshot } from "@/domain/editor-snapshot";
import type { MediaInfo } from "@/lib/tauri/media.types";

export const importQueueItemActivated = createAction<{
  id: string;
  loadToken: number;
  media?: MediaInfo;
  snapshot: EditorSnapshot;
}>("importQueue/itemActivated");
