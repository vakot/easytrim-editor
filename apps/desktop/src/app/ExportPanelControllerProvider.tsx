import { useMemo, useRef, type ReactNode } from "react";

import {
  ExportPanelControllerContext,
  type ExportPanelController,
} from "@/app/export-panel-context";
import type { ExportPanelHandle } from "@/features/export";

export function ExportPanelControllerProvider({ children }: { children: ReactNode }) {
  const panelRef = useRef<ExportPanelHandle | null>(null);
  const controller = useMemo<ExportPanelController>(
    () => ({
      panelRef,
      startFastCut: () => panelRef.current?.startFastCut(),
      openOptimizedDialog: () => panelRef.current?.openOptimizedDialog(),
    }),
    [],
  );

  return (
    <ExportPanelControllerContext.Provider value={controller}>
      {children}
    </ExportPanelControllerContext.Provider>
  );
}
