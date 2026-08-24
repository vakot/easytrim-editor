import { useTranslation } from "react-i18next";

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
      className="grid size-full min-h-0 place-items-center overflow-auto bg-preview-surface px-6 py-8"
      aria-label={t("preview.emptyMock.label")}
    >
      <div className="grid w-[clamp(12rem,35vw,24rem)] max-w-full justify-items-center gap-10">
        <img
          src="/logo-symbol.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none aspect-square w-full grayscale opacity-20"
        />

        <div
          className="grid w-full gap-2 text-left text-base text-muted-foreground"
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
                      <span aria-hidden="true">{shortcut.separator ?? "+"}</span>
                    ) : null}
                    {/* <kbd className="rounded border border-border bg-card px-2 py-1 font-mono text-sm text-foreground shadow-sm"> */}
                      <kbd
  className="
    inline-flex min-w-8 items-center justify-center
    rounded-md border border-zinc-700
    bg-zinc-900 px-2 py-1
    font-mono text-sm font-medium text-zinc-100
    shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]
  "
>
                      {key}
                    </kbd>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
