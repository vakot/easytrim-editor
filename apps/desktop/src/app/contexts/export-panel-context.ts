import { createContext, type RefObject } from "react";

import type { ExportPanelHandle } from "@/features/export";

export interface ExportPanelController {
  panelRef: RefObject<ExportPanelHandle | null>;
  startFastCut: () => void;
  openOptimizedDialog: () => void;
}

export const ExportPanelControllerContext = createContext<ExportPanelController | null>(null);
