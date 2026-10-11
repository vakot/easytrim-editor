import { Suspense } from "react";
import { useTranslation } from "react-i18next";

import type { SidebarViewId } from "@/app/layout/lib/sidebar-layout";
import { WORKSPACE_VIEW_COMPONENTS } from "@/app/layout/lib/workspace-view-loaders";

function WorkspaceViewContent({ viewId }: { viewId: SidebarViewId }) {
  const { t } = useTranslation();
  const View = WORKSPACE_VIEW_COMPONENTS[viewId];

  return (
    <Suspense
      fallback={
        <div className="p-3 text-sm text-muted-foreground" role="status">
          {t("common.status.loading")}
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 px-2" data-slot="layout-workspace-view">
        <View />
      </div>
    </Suspense>
  );
}

export { WorkspaceViewContent };
