import { DragDropProvider } from "@dnd-kit/react";
import { useLayoutEffect, useState } from "react";

import { AppLayoutFooter } from "@/app/layout/components/AppLayoutFooter";
import { AppLayoutHeader } from "@/app/layout/components/AppLayoutHeader";
import { SidebarDragPreview } from "@/app/layout/components/AppLayoutSidebar";
import { AppLayoutWorkspace } from "@/app/layout/components/AppLayoutWorkspace";
import { SidebarViewPortals } from "@/app/layout/components/SidebarViewPortal";
import { useSidebarDragAndDrop } from "@/app/layout/hooks/useSidebarDragAndDrop";
import { createSidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectUiScalePercent } from "@/app/store/slices/preferences-slice";

function AppLayout() {
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const [viewHosts] = useState(createSidebarViewHosts);
  const drag = useSidebarDragAndDrop();

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = `${uiScalePercent}%`;
    return () => {
      root.style.fontSize = previousFontSize;
    };
  }, [uiScalePercent]);

  return (
    <DragDropProvider
      onDragEnd={drag.handleDragEnd}
      onDragMove={drag.handleDragMove}
      onDragStart={drag.handleDragStart}
    >
      <main
        className="fixed inset-0 grid h-dvh w-screen grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background"
        onKeyDown={drag.handleKeyboardDragKeyDown}
      >
        <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
          {drag.keyboardDragAnnouncement}
        </div>
        <AppLayoutHeader />

        <AppLayoutWorkspace
          dragPreviewViewId={drag.dragPreview?.viewId ?? null}
          dropPlacement={drag.dropPlacement}
          isDraggingView={drag.isDraggingView}
          sidebarLayout={drag.sidebarLayout}
          sidebarVisibility={drag.sidebarVisibility}
          viewHosts={viewHosts}
        />

        <SidebarViewPortals hosts={viewHosts} />
        <AppLayoutFooter />
        {drag.dragPreview ? (
          <SidebarDragPreview
            position={drag.dragPreview.position}
            viewId={drag.dragPreview.viewId}
          />
        ) : null}
      </main>
    </DragDropProvider>
  );
}

export { AppLayout };
