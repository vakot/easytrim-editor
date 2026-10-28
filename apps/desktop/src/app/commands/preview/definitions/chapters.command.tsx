import { BookmarkPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { preloadOnIntent } from "@easytrim-editor/ui/lazy-component";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { AppChaptersDialog } from "@/app/dialogs/AppChaptersDialog";
import { useChaptersDialog } from "@/app/hooks/useAppDialog";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceReady } from "@/app/store/slices/source-slice";

function useOpenChaptersCommand() {
  const { t } = useTranslation();
  const { openDialog } = useChaptersDialog();
  const sourceReady = useAppSelector(selectSourceReady);
  const label = t("timeline.chapters.actions.manageChapters");

  return {
    enabled: sourceReady,
    icon: <BookmarkPlus aria-hidden="true" />,
    preload: preloadOnIntent(AppChaptersDialog.preload),
    run: openDialog,
    id: "open-chapters" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|chapters|open|dialog|bookmarks|markers`),
    variant: "default" as const,
  };
}

export { useOpenChaptersCommand };
