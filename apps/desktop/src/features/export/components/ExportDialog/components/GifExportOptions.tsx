import { useTranslation } from "react-i18next";

function GifExportOptions() {
  const { t } = useTranslation();

  return <section aria-label={t("export.gif.dialog.optionsLabel")} data-testid="gif-export-options" />;
}

export { GifExportOptions };
