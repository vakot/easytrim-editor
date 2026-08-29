export type ContextMenuId = "file" | "view" | "queue" | "settings" | "help";

export interface MenuNavigation {
  onOpenChange: (isOpen: boolean) => void;
  onTriggerPointerEnter: () => void;
  onTriggerPointerLeave: () => void;
  open: boolean;
}
