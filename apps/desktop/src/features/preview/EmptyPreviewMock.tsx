import { Coffee } from "lucide-react";
import { useTranslation } from "react-i18next";

import { openExternalUrl } from "@/lib/open-external-url";
import styles from "./EmptyPreviewMock.module.css";

const KOFI_URL = "https://ko-fi.com/vakot";

const shortcuts = [
  {
    id: "open-file",
    label: "app.topBarMenus.openFile",
    keys: ["Ctrl", "O"],
    separator: undefined,
  },
  {
    id: "save-lossless-cut",
    label: "app.topBarMenus.saveLosslessCut",
    keys: ["Ctrl", "S"],
    separator: undefined,
  },
  {
    id: "export-optimized",
    label: "app.topBarMenus.optimizeExport",
    keys: ["Ctrl", "E"],
    separator: undefined,
  },
  {
    id: "play-pause",
    label: "preview.emptyMock.shortcuts.playPause",
    keys: ["Space"],
    separator: undefined,
  },
  {
    id: "previous-next-frame",
    label: "preview.emptyMock.shortcuts.previousNextFrame",
    keys: ["←", "→"],
    separator: "/",
  },
  {
    id: "mark-in-out",
    label: "preview.emptyMock.shortcuts.markInOut",
    keys: ["I", "O"],
    separator: "/",
  },
] as const;

export function EmptyPreviewMock() {
  const { t } = useTranslation();

  return (
    <section
      className={`${styles.preview} grid size-full min-h-0 place-items-center overflow-hidden bg-preview-surface px-6 py-8`}
      aria-label={t("preview.emptyMock.label")}
    >
      <div className="grid w-[clamp(10rem,28vw,18rem)] max-w-full justify-items-center gap-10">
        <img
          src="/logo-symbol.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none aspect-square w-full grayscale opacity-20"
        />

        <div className="grid w-full justify-items-center gap-4">
          <div
            className={`${styles.hints} grid w-full gap-2 text-left text-sm text-muted-foreground`}
            role="list"
            aria-label={t("preview.emptyMock.shortcutsLabel")}
          >
            {shortcuts.map((shortcut) => (
              <div className="flex min-w-0 items-center gap-3" key={shortcut.id} role="listitem">
                <span className="shrink-0">{t(shortcut.label)}</span>
                <span
                  className="min-w-4 flex-1 border-b border-dotted border-muted-foreground/40"
                  aria-hidden="true"
                />
                <span
                  className="flex shrink-0 items-center gap-1"
                  aria-label={shortcut.keys.join(` ${shortcut.separator ?? "+"} `)}
                >
                  {shortcut.keys.map((key) => (
                    <span className="flex items-center gap-1" key={key}>
                      {key !== shortcut.keys[0] ? (
                        <span
                          className="inline-flex w-3 shrink-0 justify-center font-mono text-xs"
                          aria-hidden="true"
                        >
                          {shortcut.separator ?? "+"}
                        </span>
                      ) : null}
                      <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-border bg-card px-1.5 py-0.5 font-mono text-xs font-medium text-card-foreground shadow-sm">
                        {key}
                      </kbd>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>

          <a
            className="inline-flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            href={KOFI_URL}
            onClick={(event) => {
              event.preventDefault();
              void openExternalUrl(KOFI_URL);
            }}
          >
            <Coffee className="size-3.5 text-primary" aria-hidden="true" />
            <span>{t("support.onKofi")}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
