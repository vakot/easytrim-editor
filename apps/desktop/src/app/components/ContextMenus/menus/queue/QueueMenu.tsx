import { CircleStop, LogOut, Moon, Play, Power } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { QueueFinishAction } from "@/lib/tauri/queue";

import type { MenuNavigation } from "../../types";

interface QueueMenuProps {
  navigation: MenuNavigation;
  queueStarted: boolean;
  hasQueuedItems: boolean;
  hasActiveItem: boolean;
  onQueueStartedChange: (enabled: boolean) => void;
  onCancelActive: () => void;
  onCancelQueue: () => void;
  queueFinishAction: QueueFinishAction;
  availableQueueFinishActions: QueueFinishAction[];
  onQueueFinishActionChange: (action: QueueFinishAction) => void;
}

export function QueueMenu({
  navigation,
  queueStarted,
  hasQueuedItems,
  hasActiveItem,
  onQueueStartedChange,
  onCancelActive,
  onCancelQueue,
  queueFinishAction,
  availableQueueFinishActions,
  onQueueFinishActionChange,
}: QueueMenuProps) {
  const { t } = useTranslation();
  const [isCancelQueueConfirmOpen, setIsCancelQueueConfirmOpen] = useState(false);
  const queueSwitchInteractionRef = useRef(false);
  const queueFinishLabels: Record<QueueFinishAction, string> = {
    exit: t("app.queue.finish.exit"),
    systemSleep: t("app.queue.finish.systemSleep"),
    systemShutdown: t("app.queue.finish.systemShutdown"),
    nothing: t("app.queue.finish.nothing"),
  };
  const queueFinishIcons: Record<QueueFinishAction, ReactNode> = {
    exit: <LogOut className="size-3" aria-hidden="true" />,
    systemSleep: <Moon className="size-3" aria-hidden="true" />,
    systemShutdown: <Power className="size-3" aria-hidden="true" />,
    nothing: <CircleStop className="size-3" aria-hidden="true" />,
  };
  const queueFinishOptions: ContextMenuOption[] = availableQueueFinishActions.map((action) => ({
    id: `queue-finish-${action}`,
    children: queueFinishLabels[action],
    icon: queueFinishIcons[action],
    selected: action === queueFinishAction,
    shouldCloseOnClick: false,
    onSelect: () => onQueueFinishActionChange(action),
  }));
  const startQueueOptions: ContextMenuOption[] =
    hasQueuedItems && !queueStarted
      ? [
          {
            id: "start-queue",
            children: t("app.queue.start"),
            ariaKeyShortcuts: "Enter",
            suffix: (
              <span className="flex items-center gap-2">
                <span>Enter</span>
                <Switch
                  size="sm"
                  checked={queueStarted}
                  aria-label={t("app.queue.start")}
                  onCheckedChange={onQueueStartedChange}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={() => {
                    queueSwitchInteractionRef.current = true;
                  }}
                  onPointerDown={(event) => {
                    queueSwitchInteractionRef.current = true;
                    event.stopPropagation();
                  }}
                />
              </span>
            ),
            shouldCloseOnClick: false,
            onSelect: () => {
              if (queueSwitchInteractionRef.current) {
                queueSwitchInteractionRef.current = false;
                return;
              }
              onQueueStartedChange(true);
            },
          },
          { id: "queue-start-divider", separator: true },
        ]
      : [];

  return (
    <>
      <ContextMenu
        {...navigation}
        options={[
          ...startQueueOptions,
          {
            id: "cancel-active-queue-item",
            children: t("app.queue.skip"),
            icon: <CircleStop className="size-3" aria-hidden="true" />,
            disabled: !hasActiveItem,
            onSelect: onCancelActive,
          },
          {
            id: "cancel-queue",
            children: t("app.queue.cancel"),
            icon: <Power className="size-3" aria-hidden="true" />,
            disabled: !hasQueuedItems && !hasActiveItem,
            onSelect: () => setIsCancelQueueConfirmOpen(true),
          },
          { id: "queue-finish-divider", separator: true },
          {
            id: "queue-finish",
            children: t("app.queue.onFinish"),
            icon: <Play className="size-3" aria-hidden="true" />,
            suffix: queueFinishLabels[queueFinishAction],
            shouldCloseOnClick: false,
            options: queueFinishOptions,
          },
        ]}
      >
        {t("app.topBarMenus.queue")}
      </ContextMenu>
      <Dialog open={isCancelQueueConfirmOpen} onOpenChange={setIsCancelQueueConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("app.queue.cancelQueueTitle")}</DialogTitle>
            <DialogDescription>{t("app.queue.cancelQueueDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelQueueConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsCancelQueueConfirmOpen(false);
                onCancelQueue();
              }}
            >
              {t("app.queue.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
