import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function NativeDialogOverlay() {
  const { t } = useTranslation();

  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/55 backdrop-blur-sm"
      role="status"
    >
      <div className="grid min-w-64 justify-items-center gap-2 rounded-xl border border-border bg-popover p-6 text-center shadow-2xl">
        <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
        <strong className="text-sm">{t("app.nativeDialog.title")}</strong>
        <span className="text-xs text-muted-foreground">{t("app.nativeDialog.description")}</span>
      </div>
    </div>
  );
}
