import { useTranslation } from "react-i18next";

const EMPTY_VALUE = "—";
const EMPTY_STAGE_WIDTH = "w-[clamp(12rem,35vw,24rem)] max-w-[calc(100vw-3rem)]";

export function EmptyEditorStage() {
  const { t } = useTranslation();
  const shortcuts = [
    { label: t("import.emptyStage.shortcuts.open"), keys: ["Ctrl", "O"] },
    { label: t("import.emptyStage.shortcuts.save"), keys: ["Ctrl", "S"] },
    { label: t("import.emptyStage.shortcuts.export"), keys: ["Ctrl", "E"] },
    { label: t("import.emptyStage.shortcuts.playPause"), keys: ["Space"] },
    { label: t("import.emptyStage.shortcuts.previousFrame"), keys: ["←"] },
    { label: t("import.emptyStage.shortcuts.nextFrame"), keys: ["→"] },
    { label: t("import.emptyStage.shortcuts.setStart"), keys: ["I"] },
    { label: t("import.emptyStage.shortcuts.setEnd"), keys: ["O"] },
  ];

  return (
    <div
      className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_minmax(11rem,30%)] bg-background"
      aria-label={t("import.source.previewArea")}
    >
      <section className="grid min-h-0 place-items-center border-b border-border/70 bg-muted/10">
        <div className={`grid ${EMPTY_STAGE_WIDTH} justify-items-center gap-5 px-6 text-center`}>
          <img
            src="/logo-symbol.svg"
            alt=""
            aria-hidden="true"
            className={`${EMPTY_STAGE_WIDTH} pointer-events-none aspect-square grayscale opacity-100`}
          />
          <div className="grid gap-1">
            <h1 className="text-sm font-semibold text-foreground">
              {t("import.emptyStage.title")}
            </h1>
            <p className="text-xs text-muted-foreground">{t("import.emptyStage.description")}</p>
          </div>
          <div
            className="grid w-full gap-1.5 text-left text-xs text-muted-foreground"
            role="list"
            aria-label={t("import.emptyStage.shortcutsLabel")}
          >
            {shortcuts.map((shortcut) => (
              <div className="flex min-w-0 items-center gap-2" key={shortcut.label} role="listitem">
                <span className="shrink-0">{shortcut.label}</span>
                <span
                  className="min-w-4 flex-1 border-b border-dotted border-border/70"
                  aria-hidden="true"
                />
                <span
                  className="flex shrink-0 items-center gap-1"
                  aria-label={shortcut.keys.join(" + ")}
                >
                  {shortcut.keys.map((key, index) => (
                    <span className="flex items-center gap-1" key={key}>
                      {index > 0 ? <span aria-hidden="true">+</span> : null}
                      <kbd
                        data-slot="keyboard-key"
                        className="inline-flex h-7 min-w-8 items-center justify-center rounded-md border border-border/80 bg-muted px-2 font-sans text-[13px] leading-none text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.2)]"
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

      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background">
        <div className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-2">
          <span className="text-xs font-semibold text-foreground">
            {t("timeline.selectedSegment")}
          </span>
          <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
            <span>
              {t("timeline.start")}: {EMPTY_VALUE}
            </span>
            <span>
              {t("timeline.end")}: {EMPTY_VALUE}
            </span>
            <span>
              {t("timeline.duration")}: {EMPTY_VALUE}
            </span>
          </div>
        </div>

        <div
          className="relative min-h-0 px-4 py-5"
          aria-label={t("timeline.trackLabel")}
          aria-description={t("import.emptyStage.timelinePlaceholder")}
        >
          <div className="absolute inset-x-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
          <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between text-[10px] text-muted-foreground">
            <span>{EMPTY_VALUE}</span>
            <span>{EMPTY_VALUE}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
