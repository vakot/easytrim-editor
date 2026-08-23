import { useTranslation } from "react-i18next";

const EMPTY_VALUE = "—";

export function EmptyEditorStage() {
  const { t } = useTranslation();

  return (
    <div
      className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_minmax(11rem,30%)] bg-background"
      aria-label={t("import.source.previewArea")}
    >
      <section className="grid min-h-0 place-items-center border-b border-border/70 bg-muted/10">
        <div className="relative grid justify-items-center gap-3 px-6 text-center">
          <img
            src="/logo-symbol.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none size-[clamp(12rem,35vw,24rem)] grayscale opacity-100"
          />
          <div className="absolute inset-x-0 bottom-0 grid gap-1 bg-background/80 px-4 py-2">
            <h1 className="text-sm font-semibold text-foreground">
              {t("import.emptyStage.title")}
            </h1>
            <p className="text-xs text-muted-foreground">{t("import.emptyStage.description")}</p>
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
