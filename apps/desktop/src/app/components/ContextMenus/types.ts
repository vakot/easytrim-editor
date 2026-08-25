import type { ToolDefaultKey, ToolDefaults } from "@/app/tool-settings";
import type { QueueFinishAction } from "@/lib/tauri/queue";

export type ContextMenuId = "file" | "view" | "queue" | "settings" | "help";

export interface MenuNavigation {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onTriggerPointerEnter: () => void;
}

export interface ContextMenusProps {
  isChoosingSource: boolean;
  hasSource?: boolean;
  canSave: boolean;
  canExport: boolean;
  onChooseSource: () => void;
  onCloseFile?: () => void;
  onSave: () => void;
  onExport: () => void;
  queueStarted?: boolean;
  hasQueuedItems?: boolean;
  hasActiveItem?: boolean;
  onQueueStartedChange?: (enabled: boolean) => void;
  onCancelActive?: () => void;
  onCancelQueue?: () => void;
  queueFinishAction?: QueueFinishAction;
  availableQueueFinishActions?: QueueFinishAction[];
  onQueueFinishActionChange?: (action: QueueFinishAction) => void;
  toolDefaults?: ToolDefaults;
  onToolDefaultChange?: (key: ToolDefaultKey, enabled: boolean) => void;
  onResetToolDefaults?: () => void;
}
