import { useTranslation } from "react-i18next";

import { SourceTabs, SourceTree } from "@/features/source";

export function EditorSource() {
  const { t } = useTranslation();

  return (
    <aside aria-label={t("source.labels.title")} className="flex size-full min-h-0 flex-col pt-3">
      <h3
        className="mx-3 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="source-panel-title"
      >
        {t("source.labels.title")}
      </h3>

      <SourceTabs background="card" orientation="vertical" />
      <SourceTree />
    </aside>
  );
}
