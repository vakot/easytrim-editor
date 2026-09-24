import { Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";
import {
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
} from "@/app/store/slices/import-workflow-slice";
import { selectHasSource } from "@/app/store/slices/source-slice";
import { useSourceDelete } from "@/features/source";

function useDeleteFileCommand() {
  const { t } = useTranslation();
  const { requestSourceDelete } = useSourceDelete();
  const activeSource = useAppSelector(selectActiveEditingInstance);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  const enabled = hasSource && !isChoosingSource && !isNativeDialogOpen && Boolean(activeSource);
  return {
    enabled,
    icon: <Trash2Icon aria-hidden="true" />,
    run() {
      if (activeSource) requestSourceDelete({ sourceIds: [activeSource.id] });
    },
    id: "delete-file" as const,
    label: t("app.actions.deleteFile"),
    searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.deleteFile")),
    shortcut: { code: "KeyD", key: "D", modifier: "control" } as const,
    variant: "destructive" as const,
  };
}

export { useDeleteFileCommand };
