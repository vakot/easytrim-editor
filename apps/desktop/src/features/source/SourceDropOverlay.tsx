import { FileVideo2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectIsSourceDragActive } from "@/app/store/slices/import-workflow-slice";

export function SourceDropOverlay() {
  const { t } = useTranslation();
  const isSourceDragActive = useAppSelector(selectIsSourceDragActive);

  if (!isSourceDragActive) return null;

  return (
    <div
      aria-label={t("source.labels.drop")}
      aria-live="polite"
      className="absolute inset-0 z-40 grid place-items-center bg-background/82 backdrop-blur-sm"
      role="status"
    >
      <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-primary/70 bg-card/95 px-10 py-8 text-center shadow-2xl">
        <span className="relative grid size-12 place-items-center rounded-full bg-primary/12 text-primary">
          <FileVideo2 aria-hidden="true" className="size-6" />
          <Plus className="absolute -right-0.5 -bottom-0.5 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" />
        </span>
        <strong>{t("source.labels.drop")}</strong>
        <span className="text-xs text-muted-foreground">{t("source.messages.dropReset")}</span>
      </div>
    </div>
  );
}
