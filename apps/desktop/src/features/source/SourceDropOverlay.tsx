import { FileVideo2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Backdrop } from "@/components/ui/backdrop";
import { Card, CardContent } from "@/components/ui/card";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectIsSourceDragActive } from "@/app/store/slices/import-workflow-slice";

export function SourceDropOverlay() {
  const { t } = useTranslation();
  const isSourceDragActive = useAppSelector(selectIsSourceDragActive);

  if (!isSourceDragActive) return null;

  return (
    <Backdrop aria-label={t("source.labels.drop")} role="status">
      <Card className="min-w-64">
        <CardContent className="grid justify-items-center gap-3">
          <span className="relative grid size-12 place-items-center rounded-full bg-primary/12 text-primary">
            <FileVideo2 aria-hidden="true" className="size-6" />
            <Plus
              aria-hidden="true"
              className="absolute -right-0.5 -bottom-0.5 size-4 rounded-full bg-primary p-0.5 text-primary-foreground"
            />
          </span>
          <strong className="text-sm">{t("source.labels.drop")}</strong>
          <span className="text-xs text-muted-foreground">{t("source.messages.dropReset")}</span>
        </CardContent>
      </Card>
    </Backdrop>
  );
}
