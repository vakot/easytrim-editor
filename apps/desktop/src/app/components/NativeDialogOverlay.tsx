import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectIsNativeDialogOpen } from "@/app/store/slices/import-workflow-slice";

export function NativeDialogOverlay() {
  const { t } = useTranslation();
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);

  if (!isNativeDialogOpen) return null;

  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-100 grid place-items-center bg-black/55 backdrop-blur-sm"
      role="status"
    >
      <div className="grid min-w-64 justify-items-center gap-2 rounded-xl border border-border bg-popover p-6 text-center shadow-2xl">
        <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
        <strong className="text-sm">{t("app.dialogs.nativeSystem.title")}</strong>
        <span className="text-xs text-muted-foreground">
          {t("app.dialogs.nativeSystem.description")}
        </span>
      </div>
    </div>
  );
}
