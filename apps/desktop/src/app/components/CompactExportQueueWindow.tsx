import type { PointerEvent } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ScrollArea } from "@/components/ui/scroll-area";

import {
  ExportQueueWidget,
  ExportQueueWidgetActive,
  ExportQueueWidgetActiveDetails,
  ExportQueueWidgetPendingItem,
  ExportQueueWidgetPendingList,
} from "@/features/export";
import { startWindowDragging } from "@/lib/tauri/window";

import { ExportQueueWindowToggle } from "./ExportQueueWindowToggle";

interface CompactExportQueueWindowProps {
  disabled?: boolean;
  onRestore: () => void;
}

interface PendingDrag {
  clientX: number;
  clientY: number;
  dragging: boolean;
  pointerId: number;
}

const DRAG_START_DISTANCE = 4;
const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [role="scrollbar"]';

export function CompactExportQueueWindow({ disabled, onRestore }: CompactExportQueueWindowProps) {
  const { t } = useTranslation();
  const pendingDrag = useRef<PendingDrag | null>(null);
  const [windowActionError, setWindowActionError] = useState(false);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      event.button !== 0 ||
      (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR))
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    pendingDrag.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      dragging: false,
      pointerId: event.pointerId,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = pendingDrag.current;
    if (!drag || drag.dragging || drag.pointerId !== event.pointerId) return;

    const movedX = Math.abs(event.clientX - drag.clientX);
    const movedY = Math.abs(event.clientY - drag.clientY);
    if (Math.max(movedX, movedY) < DRAG_START_DISTANCE) return;

    drag.dragging = true;
    setWindowActionError(false);
    void startWindowDragging().catch(() => setWindowActionError(true));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLElement>) => {
    if (pendingDrag.current?.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pendingDrag.current = null;
  };

  return (
    <main
      aria-label={t("app.labels.exportQueue")}
      className="group fixed inset-0 flex cursor-default overflow-hidden bg-background select-none"
      onDragStart={(event) => event.preventDefault()}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
    >
      <ExportQueueWindowToggle
        active
        className="absolute top-1 left-1 z-30 bg-background/85 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        disabled={disabled}
        onClick={onRestore}
      />

      <ExportQueueWidget className="flex size-full">
        <ExportQueueWidgetActive className="aspect-video min-w-0 flex-1 shrink-0">
          <ExportQueueWidgetActiveDetails />
        </ExportQueueWidgetActive>
        <ScrollArea className="aspect-video min-w-0 flex-1 pr-0.5" type="always">
          <ExportQueueWidgetPendingList
            render={(item) => (
              <ExportQueueWidgetPendingItem compact item={item} key={item.attempt.id} />
            )}
          />
        </ScrollArea>
      </ExportQueueWidget>

      {windowActionError ? (
        <span className="sr-only" role="alert">
          {t("app.messages.windowActionFailed")}
        </span>
      ) : null}
    </main>
  );
}
