import { AppActivityDialog } from "@/app/dialogs/AppActivityDialog";
import { AppExportQueueDialog } from "@/app/dialogs/AppExportQueueDialog";
import { AppHistoryDialog } from "@/app/dialogs/AppHistoryDialog";
import { AppSourcesDialog } from "@/app/dialogs/AppSourcesDialog";
import { lazyWithPreload } from "@/lib/lazy-component";

import type { SidebarViewId } from "./sidebar-layout";

const SourcesWorkspaceView = lazyWithPreload<Record<string, never>>(() =>
  import("../components/workspace-views/SourcesWorkspaceView").then((module) => ({
    default: module.SourcesWorkspaceView,
  })),
);

const ActivityWorkspaceView = lazyWithPreload<Record<string, never>>(() =>
  import("../components/workspace-views/ActivityWorkspaceView").then((module) => ({
    default: module.ActivityWorkspaceView,
  })),
);

const HistoryWorkspaceView = lazyWithPreload<Record<string, never>>(() =>
  import("../components/workspace-views/HistoryWorkspaceView").then((module) => ({
    default: module.HistoryWorkspaceView,
  })),
);

const ExportQueueWorkspaceView = lazyWithPreload<Record<string, never>>(() =>
  import("../components/workspace-views/ExportQueueWorkspaceView").then((module) => ({
    default: module.ExportQueueWorkspaceView,
  })),
);

const WORKSPACE_VIEW_COMPONENTS = {
  activity: ActivityWorkspaceView,
  exportQueue: ExportQueueWorkspaceView,
  history: HistoryWorkspaceView,
  sources: SourcesWorkspaceView,
} satisfies Record<SidebarViewId, typeof SourcesWorkspaceView>;

const WORKSPACE_DIALOG_COMPONENTS = {
  activity: AppActivityDialog,
  exportQueue: AppExportQueueDialog,
  history: AppHistoryDialog,
  sources: AppSourcesDialog,
} satisfies Record<
  SidebarViewId,
  typeof AppActivityDialog | typeof AppExportQueueDialog | typeof AppSourcesDialog
>;

function preloadWorkspaceView(viewId: SidebarViewId) {
  return WORKSPACE_VIEW_COMPONENTS[viewId].preload();
}

function preloadWorkspaceDialog(viewId: SidebarViewId) {
  return WORKSPACE_DIALOG_COMPONENTS[viewId].preload();
}

export {
  preloadWorkspaceDialog,
  preloadWorkspaceView,
  WORKSPACE_DIALOG_COMPONENTS,
  WORKSPACE_VIEW_COMPONENTS,
};
