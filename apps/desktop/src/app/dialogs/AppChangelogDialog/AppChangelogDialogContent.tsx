import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ChangelogList, type ChangelogRelease } from "@/features/changelog";
import { openExternalUrl } from "@/lib/open-external-url.utils";

const CHANGELOG_URL = "https://github.com/vakot/easytrim-editor/blob/master/CHANGELOG.md";

interface AppChangelogDialogContentProps {
  isWhatsNew: boolean;
  onClose: () => void;
  releases: readonly ChangelogRelease[];
}

function AppChangelogDialogContent({
  isWhatsNew,
  onClose,
  releases,
}: AppChangelogDialogContentProps) {
  const { t } = useTranslation();

  const title = isWhatsNew ? t("support.whatsNew.title") : t("support.changelog.title");

  const description = isWhatsNew
    ? t("support.whatsNew.description")
    : t("support.changelog.description");

  return (
    <>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <ScrollArea className="-mx-4 min-h-0 px-4" fadeColor="var(--popover)">
        <ChangelogList releases={releases} />
      </ScrollArea>

      <DialogFooter className="items-center sm:justify-between">
        <Button onClick={() => void openExternalUrl(CHANGELOG_URL)} type="button" variant="ghost">
          <ExternalLink aria-hidden="true" />
          {t("support.project.actions.viewOnGitHub")}
        </Button>
        <Button onClick={onClose} type="button">
          {t("common.actions.close")}
        </Button>
      </DialogFooter>
    </>
  );
}

export { AppChangelogDialogContent };
export type { AppChangelogDialogContentProps };
