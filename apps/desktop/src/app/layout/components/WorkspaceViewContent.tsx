import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import type { SidebarViewId } from "@/app/layout/lib/sidebar-layout";

const SourcesWorkspaceView = lazy(() =>
  import("./workspace-views/SourcesWorkspaceView").then((module) => ({
    default: module.SourcesWorkspaceView,
  })),
);

const ActivityWorkspaceView = lazy(() =>
  import("./workspace-views/ActivityWorkspaceView").then((module) => ({
    default: module.ActivityWorkspaceView,
  })),
);

const ExportQueueWorkspaceView = lazy(() =>
  import("./workspace-views/ExportQueueWorkspaceView").then((module) => ({
    default: module.ExportQueueWorkspaceView,
  })),
);

const SIDEBAR_VIEWS: Record<SidebarViewId, React.LazyExoticComponent<() => React.JSX.Element>> = {
  sources: SourcesWorkspaceView,
  exportQueue: ExportQueueWorkspaceView,
  activity: ActivityWorkspaceView,
};

function WorkspaceViewContent({ viewId }: { viewId: SidebarViewId }) {
  const { t } = useTranslation();
  const View = SIDEBAR_VIEWS[viewId];

  return (
    <Suspense
      fallback={
        <div className="p-3 text-sm text-muted-foreground" role="status">
          {t("common.status.loading")}
        </div>
      }
    >
      <div className="flex flex-1 px-2" data-slot="layout-workspace-view">
        <View />
      </div>
    </Suspense>
  );
}

export { WorkspaceViewContent };
