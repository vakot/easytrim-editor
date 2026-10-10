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

function WorkspaceViewContent({ viewId }: { viewId: SidebarViewId }) {
  const { t } = useTranslation();
  const View =
    viewId === "sources"
      ? SourcesWorkspaceView
      : viewId === "activity"
        ? ActivityWorkspaceView
        : ExportQueueWorkspaceView;

  return (
    <Suspense
      fallback={
        <div className="p-3 text-sm text-muted-foreground" role="status">
          {t("common.status.loading")}
        </div>
      }
    >
      <View />
    </Suspense>
  );
}

export { WorkspaceViewContent };
