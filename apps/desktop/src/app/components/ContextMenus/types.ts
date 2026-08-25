export type ContextMenuId = "file" | "view" | "queue" | "settings" | "help";

export interface MenuNavigation {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onTriggerPointerEnter: () => void;
}
