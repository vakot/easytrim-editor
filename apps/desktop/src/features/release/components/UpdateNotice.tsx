import { ExternalLink, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { openExternalUrl } from "@/lib/open-external-url";

import type { AvailableUpdate } from "../release-check";

export function UpdateNotice({ update }: { update: AvailableUpdate }) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <aside
      className="fixed top-4 left-1/2 z-50 flex w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-xl border border-primary/30 bg-card/95 px-4 py-3 text-card-foreground shadow-xl backdrop-blur-md"
      role="status"
    >
      <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{t("release.updateAvailable")}</span>
        <span className="ml-1 text-muted-foreground">{update.name}</span>
      </p>
      <Button size="sm" onClick={() => void openExternalUrl(update.url)}>
        {t("release.update")}
        <ExternalLink aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("release.dismiss")}
        onClick={() => setIsVisible(false)}
      >
        <X aria-hidden="true" />
      </Button>
    </aside>
  );
}
