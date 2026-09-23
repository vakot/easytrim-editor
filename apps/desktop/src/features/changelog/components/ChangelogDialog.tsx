import type { TFunction } from "i18next";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { openExternalUrl } from "@/lib/open-external-url.utils";

import type { ChangelogCategory, ChangelogRelease } from "../types";

const CHANGELOG_URL = "https://github.com/vakot/easytrim-editor/blob/master/CHANGELOG.md";

type ChangelogDialogMode = "changelog" | "whats-new";

interface ChangelogDialogProps {
  mode: ChangelogDialogMode | null;
  onClose: () => void;
  releases: readonly ChangelogRelease[];
}

function ChangelogDialog({ mode, onClose, releases }: ChangelogDialogProps) {
  const { t } = useTranslation();
  const isWhatsNew = mode === "whats-new";
  const title = isWhatsNew ? t("support.labels.whatsNewTitle") : t("support.labels.historyTitle");
  const description = isWhatsNew
    ? t("support.messages.whatsNewDescription")
    : t("support.messages.historyDescription");

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={mode !== null}>
      <DialogContent className="grid max-h-[min(80dvh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 px-6">
          <div className="space-y-8 py-6">
            {releases.length > 0 ? (
              releases.map((release) => (
                <article className="space-y-4" key={release.version}>
                  <h2 className="border-b border-border/70 pb-2 font-heading text-base font-semibold tracking-tight">
                    v{release.version}
                  </h2>
                  <div className="space-y-4 pl-3">
                    {release.sections.map((section) => (
                      <section
                        className="space-y-1.5"
                        key={`${release.version}-${section.category}`}
                      >
                        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {translateCategory(t, section.category)}
                        </h3>
                        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90">
                          {section.entries.map((entry) => (
                            <li key={entry}>{entry}</li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("support.messages.emptyChangelog")}
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="sm:justify-between">
          <Button onClick={() => void openExternalUrl(CHANGELOG_URL)} type="button" variant="ghost">
            <ExternalLink aria-hidden="true" />
            {t("support.actions.viewOnGitHub")}
          </Button>
          <Button onClick={onClose} type="button">
            {t("common.actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function translateCategory(t: TFunction, category: ChangelogCategory): string {
  switch (category) {
    case "Added":
      return t("support.labels.categories.added");
    case "Changed":
      return t("support.labels.categories.changed");
    case "Deprecated":
      return t("support.labels.categories.deprecated");
    case "Fixed":
      return t("support.labels.categories.fixed");
    case "Removed":
      return t("support.labels.categories.removed");
    case "Security":
      return t("support.labels.categories.security");
  }
}

export { ChangelogDialog };
export type { ChangelogDialogMode, ChangelogDialogProps };
