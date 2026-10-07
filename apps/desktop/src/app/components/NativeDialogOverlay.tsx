import { useTranslation } from "react-i18next";

import { Backdrop } from "@/components/ui/backdrop";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectIsNativeDialogOpen } from "@/app/store/slices/import-workflow-slice";

function NativeDialogOverlay() {
  const { t } = useTranslation();
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);

  if (!isNativeDialogOpen) return null;

  return (
    <Backdrop>
      <Card className="min-w-64">
        <CardContent className="grid justify-items-center gap-3">
          <Spinner aria-hidden="true" className="size-6 text-primary" />
          <strong className="text-sm">{t("app.systemDialog.confirmation.title")}</strong>
          <span className="text-xs text-muted-foreground">
            {t("app.systemDialog.confirmation.description")}
          </span>
        </CardContent>
      </Card>
    </Backdrop>
  );
}

export { NativeDialogOverlay };
