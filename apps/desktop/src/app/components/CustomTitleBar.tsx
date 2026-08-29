import { Copy, Minus, Square, X } from "lucide-react";
import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  startWindowDragging,
  toggleWindowMaximize,
} from "@/lib/tauri/window";

interface CustomTitleBarProps {
  menuControls?: ReactNode;
  panelControls?: ReactNode;
  statusContent?: ReactNode;
}

interface PendingDrag {
  clientX: number;
  clientY: number;
  dragging: boolean;
  pointerId: number;
}

const DRAG_START_DISTANCE = 4;

export function CustomTitleBar({
  menuControls,
  panelControls,
  statusContent,
}: CustomTitleBarProps) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowActionError, setWindowActionError] = useState(false);
  const pendingDrag = useRef<PendingDrag | null>(null);

  useEffect(() => {
    let active = true;

    void isWindowMaximized().then((maximized) => {
      if (active) setIsMaximized(maximized);
    });

    return () => {
      active = false;
    };
  }, []);

  const runWindowAction = (action: () => Promise<void>) => {
    setWindowActionError(false);
    void action().catch(() => setWindowActionError(true));
  };

  const handleToggleMaximize = () => {
    runWindowAction(async () => {
      await toggleWindowMaximize();
      setIsMaximized((current) => !current);
    });
  };

  const handleTitleBarDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest('button, [role="menu"], [role="menuitem"]')
    ) {
      return;
    }

    event.preventDefault();
    pendingDrag.current = null;
    handleToggleMaximize();
  };

  const handleDragPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pendingDrag.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      dragging: false,
      pointerId: event.pointerId,
    };
  };

  const handleDragPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = pendingDrag.current;
    if (!drag || drag.dragging || drag.pointerId !== event.pointerId) return;

    const movedX = Math.abs(event.clientX - drag.clientX);
    const movedY = Math.abs(event.clientY - drag.clientY);
    if (Math.max(movedX, movedY) < DRAG_START_DISTANCE) return;

    drag.dragging = true;
    runWindowAction(startWindowDragging);
  };

  const handleDragPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (pendingDrag.current?.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pendingDrag.current = null;
  };

  return (
    <header
      aria-label={t("app.windowControls.titleBar")}
      className="relative flex h-9 min-h-9 items-center bg-background/95 text-foreground select-none"
      onDoubleClickCapture={handleTitleBarDoubleClick}
    >
      <div className="flex h-full items-center gap-2 px-3 text-left">
        <img alt="" className="size-5" src="/logo-symbol.svg" />
        <span className="text-xs font-semibold tracking-wide text-foreground/80">
          {t("common.brand")}
        </span>
      </div>

      {menuControls ? <div className="flex h-full items-center px-1">{menuControls}</div> : null}

      {statusContent ? (
        <div className="absolute left-1/2 top-1/2 flex h-full -translate-x-1/2 -translate-y-1/2 items-center px-2">
          {statusContent}
        </div>
      ) : null}

      <div
        aria-hidden="true"
        className="h-full min-w-0 flex-1 cursor-default"
        onPointerCancel={handleDragPointerEnd}
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerEnd}
      />

      {panelControls ? <div className="flex h-full items-center px-1">{panelControls}</div> : null}

      <div
        aria-label={t("app.windowControls.group")}
        className="flex h-full items-stretch"
        role="group"
      >
        <button
          aria-label={t("app.windowControls.minimize")}
          className="inline-flex w-11 items-center justify-center outline-none transition-colors hover:bg-muted focus-visible:bg-accent"
          onClick={() => runWindowAction(minimizeWindow)}
          title={t("app.windowControls.minimize")}
          type="button"
        >
          <Minus aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
        <button
          aria-label={
            isMaximized ? t("app.windowControls.restore") : t("app.windowControls.maximize")
          }
          className="inline-flex w-11 items-center justify-center outline-none transition-colors hover:bg-muted focus-visible:bg-accent"
          onClick={handleToggleMaximize}
          title={isMaximized ? t("app.windowControls.restore") : t("app.windowControls.maximize")}
          type="button"
        >
          {isMaximized ? (
            <Copy aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
          ) : (
            <Square aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
          )}
        </button>
        <button
          aria-label={t("app.windowControls.close")}
          className="inline-flex w-11 items-center justify-center outline-none transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:bg-destructive focus-visible:text-destructive-foreground"
          onClick={() => runWindowAction(closeWindow)}
          title={t("app.windowControls.close")}
          type="button"
        >
          <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
      </div>

      {windowActionError ? (
        <span className="sr-only" role="alert">
          {t("app.windowControls.error")}
        </span>
      ) : null}
    </header>
  );
}
