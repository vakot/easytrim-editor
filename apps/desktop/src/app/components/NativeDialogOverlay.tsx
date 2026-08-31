import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Backdrop } from "@/components/ui/backdrop";
import { Card, CardContent } from "@/components/ui/card";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectIsNativeDialogOpen } from "@/app/store/slices/import-workflow-slice";

export function NativeDialogOverlay() {
  const { t } = useTranslation();
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);

  if (!isNativeDialogOpen) return null;

  return (
    <Backdrop>
      <Card className="min-w-64">
        <CardContent className="grid justify-items-center gap-3">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
          <strong className="text-sm">{t("app.dialogs.nativeSystem.title")}</strong>
          <span className="text-xs text-muted-foreground">
            {t("app.dialogs.nativeSystem.description")}
          </span>
        </CardContent>
      </Card>
    </Backdrop>
  );
}
