import { Copy, Minus, Square, X } from "lucide-react";
import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/class-names.utils";
import {
  isWindowMaximized,
  minimizeWindow,
  requestWindowShutdown,
  startWindowDragging,
  toggleWindowMaximize,
} from "@/lib/tauri/window";

interface TitleBarProps {
  children?: ReactNode;
  className?: string;
}

interface PendingDrag {
  clientX: number;
  clientY: number;
  dragging: boolean;
  pointerId: number;
}

const DRAG_START_DISTANCE = 4;
const TITLE_BAR_INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [role], [tabindex]:not([tabindex="-1"])';

function isTitleBarInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest(TITLE_BAR_INTERACTIVE_SELECTOR) !== null;
}

function TitleBar({ children, className }: TitleBarProps) {
  const { t } = useTranslation();
  const { handleToggleMaximize, runWindowAction } = useWindowActions();
  const pendingDrag = useRef<PendingDrag | null>(null);

  const handleDoubleClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (isTitleBarInteractiveTarget(event.target)) return;

    event.preventDefault();
    pendingDrag.current = null;
    handleToggleMaximize();
  };

  const handleDragPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isTitleBarInteractiveTarget(event.target)) return;

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
      aria-label={t("app.accessibility.titleBar")}
      className={cn(
        "relative flex h-9 min-h-9 items-center justify-between gap-3 bg-background/95 text-foreground select-none",
        className,
      )}
      onDoubleClickCapture={handleDoubleClickCapture}
      onPointerCancel={handleDragPointerEnd}
      onPointerDown={handleDragPointerDown}
      onPointerMove={handleDragPointerMove}
      onPointerUp={handleDragPointerEnd}
    >
      {children}
    </header>
  );
}

function TitleBarWindowActions() {
  const { t } = useTranslation();

  const {
    handleToggleMaximize,
    isError: windowActionError,
    isMaximized,
    runWindowAction,
  } = useWindowActions();

  return (
    <>
      <div
        aria-label={t("app.accessibility.windowControls")}
        className="flex h-full shrink-0 items-stretch"
        role="group"
      >
        <button
          aria-label={t("app.actions.minimize")}
          className="inline-flex w-11 items-center justify-center transition-colors outline-none hover:bg-muted focus-visible:bg-accent"
          onClick={() => runWindowAction(minimizeWindow)}
          title={t("app.actions.minimize")}
          type="button"
        >
          <Minus aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
        <button
          aria-label={isMaximized ? t("app.actions.restore") : t("app.actions.maximize")}
          className="inline-flex w-11 items-center justify-center transition-colors outline-none hover:bg-muted focus-visible:bg-accent"
          onClick={handleToggleMaximize}
          title={isMaximized ? t("app.actions.restore") : t("app.actions.maximize")}
          type="button"
        >
          {isMaximized ? (
            <Copy aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
          ) : (
            <Square aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
          )}
        </button>
        <button
          aria-label={t("common.actions.close")}
          className="hover:text-destructive-foreground focus-visible:text-destructive-foreground inline-flex w-11 items-center justify-center transition-colors outline-none hover:bg-destructive focus-visible:bg-destructive"
          onClick={() => runWindowAction(requestWindowShutdown)}
          title={t("common.actions.close")}
          type="button"
        >
          <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
      </div>

      {windowActionError ? (
        <span className="sr-only" role="alert">
          {t("app.messages.windowActionFailed")}
        </span>
      ) : null}
    </>
  );
}

function useWindowActions() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isError, setIsError] = useState(false);

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
    setIsError(false);
    void action().catch(() => setIsError(true));
  };

  const handleToggleMaximize = () => {
    runWindowAction(async () => {
      await toggleWindowMaximize();
      setIsMaximized((current) => !current);
    });
  };

  return { isMaximized, isError, runWindowAction, handleToggleMaximize };
}

export { TitleBar, TitleBarWindowActions };
