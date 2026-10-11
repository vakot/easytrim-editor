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

const ExportQueueWorkspaceView = lazyWithPreload<Record<string, never>>(() =>
  import("../components/workspace-views/ExportQueueWorkspaceView").then((module) => ({
    default: module.ExportQueueWorkspaceView,
  })),
);

const ActivityWorkspaceDialog = lazyWithPreload<{
  onOpenChange: (open: boolean) => void;
  open: boolean;
}>(() =>
  import("../components/workspace-dialogs/ActivityWorkspaceDialog").then((module) => ({
    default: module.ActivityWorkspaceDialog,
  })),
);

const ExportQueueDialog = lazyWithPreload<{
  onOpenChange: (open: boolean) => void;
  open: boolean;
}>(() =>
  import("../components/workspace-dialogs/ExportQueueDialog").then((module) => ({
    default: module.ExportQueueDialog,
  })),
);

const SourcesWorkspaceDialog = lazyWithPreload<{
  onOpenChange: (open: boolean) => void;
  open: boolean;
}>(() =>
  import("../components/workspace-dialogs/SourcesWorkspaceDialog").then((module) => ({
    default: module.SourcesWorkspaceDialog,
  })),
);

const WORKSPACE_VIEW_COMPONENTS = {
  activity: ActivityWorkspaceView,
  exportQueue: ExportQueueWorkspaceView,
  sources: SourcesWorkspaceView,
} satisfies Record<SidebarViewId, typeof SourcesWorkspaceView>;

const WORKSPACE_DIALOG_COMPONENTS = {
  activity: ActivityWorkspaceDialog,
  exportQueue: ExportQueueDialog,
  sources: SourcesWorkspaceDialog,
} satisfies Record<SidebarViewId, typeof ActivityWorkspaceDialog>;

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
