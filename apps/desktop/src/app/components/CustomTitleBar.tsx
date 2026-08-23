import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MouseEvent } from "react";

import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  startWindowDragging,
  toggleWindowMaximize,
} from "@/lib/tauri/window";

interface CustomTitleBarProps {
  onLogoClick: () => void;
}

export function CustomTitleBar({ onLogoClick }: CustomTitleBarProps) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowActionError, setWindowActionError] = useState(false);

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
    handleToggleMaximize();
  };

  return (
    <header
      className="flex h-9 min-h-9 items-center border-b border-border/70 bg-background/95 text-foreground select-none"
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

      <div
        className="h-full min-w-0 flex-1 cursor-default"
        data-tauri-drag-region
        onMouseDown={(event) => {
          if (event.button === 0) runWindowAction(startWindowDragging);
        }}
        aria-hidden="true"
      />

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
