import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MouseEvent, PointerEvent, ReactNode } from "react";

import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  startWindowDragging,
  toggleWindowMaximize,
} from "@/lib/tauri/window";

interface CustomTitleBarProps {
  onLogoClick: () => void;
  menuControls?: ReactNode;
  statusContent?: ReactNode;
  panelControls?: ReactNode;
}

interface PendingDrag {
  clientX: number;
  clientY: number;
  dragging: boolean;
  pointerId: number;
}

const DRAG_START_DISTANCE = 4;

export function CustomTitleBar({
  onLogoClick,
  menuControls,
  statusContent,
  panelControls,
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
    if (event.target instanceof Element && event.target.closest("button")) return;

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
      className="relative flex h-9 min-h-9 items-center border-b border-border/70 bg-background/95 text-foreground select-none"
      aria-label={t("app.windowControls.titleBar")}
      onDoubleClickCapture={handleTitleBarDoubleClick}
    >
      <button
        type="button"
        className="group flex h-full items-center gap-2 px-3 text-left outline-none focus-visible:bg-accent"
        aria-label={t("app.windowControls.logo")}
        onClick={onLogoClick}
      >
        <img className="size-5" src="/logo-symbol.svg" alt="" />
        <span className="text-xs font-semibold tracking-wide text-foreground/80 group-hover:text-foreground">
          {t("common.brand")}
        </span>
      </button>

      {menuControls ? <div className="flex h-full items-center px-1">{menuControls}</div> : null}

      {statusContent ? <div className="flex h-full items-center px-2">{statusContent}</div> : null}

      <div
        className="h-full min-w-0 flex-1 cursor-default"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerEnd}
        onPointerCancel={handleDragPointerEnd}
        aria-hidden="true"
      />

      {panelControls ? <div className="flex h-full items-center px-1">{panelControls}</div> : null}

      <div
        className="flex h-full items-stretch"
        role="group"
        aria-label={t("app.windowControls.group")}
      >
        <button
          type="button"
          className="inline-flex w-11 items-center justify-center outline-none transition-colors hover:bg-muted focus-visible:bg-accent"
          aria-label={t("app.windowControls.minimize")}
          title={t("app.windowControls.minimize")}
          onClick={() => runWindowAction(minimizeWindow)}
        >
          <Minus className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="inline-flex w-11 items-center justify-center outline-none transition-colors hover:bg-muted focus-visible:bg-accent"
          aria-label={
            isMaximized ? t("app.windowControls.restore") : t("app.windowControls.maximize")
          }
          title={isMaximized ? t("app.windowControls.restore") : t("app.windowControls.maximize")}
          onClick={handleToggleMaximize}
        >
          {isMaximized ? (
            <Copy className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Square className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="inline-flex w-11 items-center justify-center outline-none transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:bg-destructive focus-visible:text-destructive-foreground"
          aria-label={t("app.windowControls.close")}
          title={t("app.windowControls.close")}
          onClick={() => runWindowAction(closeWindow)}
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
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
