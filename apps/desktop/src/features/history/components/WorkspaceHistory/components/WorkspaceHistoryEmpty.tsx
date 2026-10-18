import { useTranslation } from "react-i18next";

function WorkspaceHistoryEmpty() {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-0 flex-1 place-items-center px-4 text-center text-sm text-muted-foreground">
      <span>{t("history.empty")}</span>
    </div>
  );
}

export { WorkspaceHistoryEmpty };
