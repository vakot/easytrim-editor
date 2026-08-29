import { useTranslation } from "react-i18next";

import { KofiIcon } from "@/components/brand-icons";
import { openExternalUrl } from "@/lib/open-external-url.utils";

import styles from "./VideoPreviewEmpty.module.css";

const KOFI_URL = "https://ko-fi.com/vakot";

export function VideoPreviewEmpty() {
  const { t } = useTranslation();
  const shortcuts = [
    {
      id: "open-file",
      label: t("app.actions.openFile"),
      keys: ["Ctrl", "O"],
      separator: undefined,
    },
    {
      id: "save-lossless-cut",
      label: t("export.actions.fast"),
      keys: ["Ctrl", "S"],
      separator: undefined,
    },
    {
      id: "export-optimized",
      label: t("export.actions.optimized"),
      keys: ["Ctrl", "E"],
      separator: undefined,
    },
    {
      id: "play-pause",
      label: t("preview.labels.shortcutPlayPause"),
      keys: ["Space"],
      separator: undefined,
    },
    {
      id: "previous-next-frame",
      label: t("preview.labels.shortcutPreviousNextFrame"),
      keys: ["←", "→"],
      separator: "/",
    },
    {
      id: "mark-in-out",
      label: t("preview.labels.shortcutMarkInOut"),
      keys: ["I", "O"],
      separator: "/",
    },
  ] as const;

  return (
    <section
      aria-label={t("preview.accessibility.empty")}
      className={`${styles.preview} grid size-full min-h-0 place-items-center overflow-hidden px-6 py-8`}
    >
      <div className="grid w-[clamp(10rem,28vw,18rem)] max-w-full justify-items-center gap-10">
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none aspect-square w-full opacity-20 grayscale"
          src="/logo-symbol.svg"
        />

        <div className="grid w-full justify-items-center gap-4">
          <div
            aria-label={t("preview.labels.shortcuts")}
            className={`${styles.hints} grid w-full gap-2 text-left text-sm text-muted-foreground`}
            role="list"
          >
            {shortcuts.map((shortcut) => (
              <div className="flex min-w-0 items-center gap-3" key={shortcut.id} role="listitem">
                <span className="shrink-0">{shortcut.label}</span>
                <span
                  aria-hidden="true"
                  className="min-w-4 flex-1 border-b border-dotted border-muted-foreground/40"
                />
                <span
                  aria-label={shortcut.keys.join(` ${shortcut.separator ?? "+"} `)}
                  className="flex shrink-0 items-center gap-1"
                >
                  {shortcut.keys.map((key) => (
                    <span className="flex items-center gap-1" key={key}>
                      {key !== shortcut.keys[0] ? (
                        <span
                          aria-hidden="true"
                          className="inline-flex w-3 shrink-0 justify-center font-mono text-xs"
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
            <KofiIcon className="size-3.5 text-primary" />
            <span>{t("support.actions.koFi")}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
