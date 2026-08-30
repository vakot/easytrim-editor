import { useTranslation } from "react-i18next";

import { KofiIcon } from "@/components/brand-icons";
import { openExternalUrl } from "@/lib/open-external-url.utils";

const KOFI_URL = "https://ko-fi.com/vakot";

export function SupportLink() {
  const { t } = useTranslation();

  return (
    <a
      className="inline-flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      href={KOFI_URL}
      onClick={(event) => {
        event.preventDefault();
        void openExternalUrl(KOFI_URL);
      }}
    >
      <KofiIcon className="size-3 text-primary" />
      <span>{t("support.actions.koFi")}</span>
    </a>
  );
}
