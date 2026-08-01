import { Heart, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { STORAGE_KEYS, readStoredJson, writeStoredJson } from "@/lib/storage";
import { openExternalUrl } from "@/lib/open-external-url";

import { AUTHOR_SUPPORT_URL } from "@/features/release/release-check";

export function SupportBadge() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(
    () => readStoredJson<boolean>(STORAGE_KEYS.supportBadgeDismissed) !== true,
  );

  if (!isVisible) {
    return import.meta.env.DEV ? (
      <Button
        className="absolute right-4 bottom-4 z-20"
        variant="outline"
        size="sm"
        onClick={() => {
          window.localStorage.removeItem(STORAGE_KEYS.supportBadgeDismissed);
          setIsVisible(true);
        }}
      >
        {t("support.resetDevelopment")}
      </Button>
    ) : null;
  }

  function dismiss() {
    writeStoredJson(STORAGE_KEYS.supportBadgeDismissed, true);
    setIsVisible(false);
  }

  return (
    <aside className="absolute bottom-4 left-1/2 z-20 flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-xl border border-primary/25 bg-card/95 px-3 py-2.5 text-card-foreground shadow-lg backdrop-blur-md">
      <Heart className="size-4 shrink-0 fill-primary text-primary" aria-hidden="true" />
      <a
        className="min-w-0 flex-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        href={AUTHOR_SUPPORT_URL}
        onClick={(event) => {
          event.preventDefault();
          void openExternalUrl(AUTHOR_SUPPORT_URL);
        }}
      >
        {t("support.message")}
      </a>
      <Button variant="ghost" size="icon-xs" aria-label={t("support.dismiss")} onClick={dismiss}>
        <X aria-hidden="true" />
      </Button>
    </aside>
  );
}
