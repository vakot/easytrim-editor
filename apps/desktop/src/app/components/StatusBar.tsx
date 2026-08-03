import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import packageJson from "../../../../../package.json";
import { openExternalUrl } from "@/lib/open-external-url";
import type { AvailableUpdate } from "@/features/release/release-check";

export function StatusBar({ update }: { update: AvailableUpdate | null }) {
  const { t } = useTranslation();
  const appSha = import.meta.env.VITE_APP_SHA?.trim();

  return (
    <footer
      data-slot="status-bar"
      className="flex h-8 min-h-8 shrink-0 items-center border-t border-border bg-card/30 px-4 py-1 text-xs text-muted-foreground"
    >
      <span className="flex items-center gap-1.5">
        <span>v{packageJson.version}</span>
        {update ? (
          <>
            <span aria-hidden="true">·</span>
            <a
              href={update.url}
              className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
              onClick={(event) => {
                event.preventDefault();
                void openExternalUrl(update.url);
              }}
            >
              <span>{t("release.updateAvailableShort")}</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </>
        ) : null}
        {appSha ? (
          <>
            <span aria-hidden="true">·</span>
            <code>{appSha.slice(0, 7)}</code>
          </>
        ) : null}
      </span>
    </footer>
  );
}
