import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  type ApplicationCommandExecutionContext,
  type ApplicationShortcut,
  commandOrigin,
} from "@/app/commands/core/application-command.types";
import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { navigateToEditingInstance } from "@/app/store/thunks/source-media-thunks";

function useSourceNavigationCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const instances = useAppSelector(selectImportedEditingInstances);

  const activeIndex = instances.findIndex((instance) => instance.id === activeInstanceId);

  const labels = {
    next: t("source.navigation.next"),
    previous: t("source.navigation.previous"),
  };

  return [
    createSourceNavigationCommand({
      activeIndex,
      dispatch,
      icon: <ArrowUp aria-hidden="true" />,
      id: "previous-source",
      instances,
      label: labels.previous,
      offset: -1,
      shortcut: { code: "BracketLeft", key: "[", modifier: "none" } as const,
    }),
    createSourceNavigationCommand({
      activeIndex,
      dispatch,
      icon: <ArrowDown aria-hidden="true" />,
      id: "next-source",
      instances,
      label: labels.next,
      offset: 1,
      shortcut: { code: "BracketRight", key: "]", modifier: "none" } as const,
    }),
  ] as const;
}

function createSourceNavigationCommand({
  activeIndex,
  dispatch,
  icon,
  id,
  instances,
  label,
  offset,
  shortcut,
}: {
  activeIndex: number;
  dispatch: ReturnType<typeof useAppDispatch>;
  icon: React.ReactNode;
  id: "next-source" | "previous-source";
  instances: ReturnType<typeof selectImportedEditingInstances>;
  label: string;
  offset: -1 | 1;
  shortcut: ApplicationShortcut;
}) {
  const target = instances[activeIndex + offset];
  return {
    enabled: target !== undefined,
    icon,
    run({ surface }: ApplicationCommandExecutionContext) {
      if (target) void dispatch(navigateToEditingInstance(target.id, commandOrigin(id, surface)));
    },
    id,
    label,
    searchTerms: commandSearchTerms(`${label}|source|${id.replace("-source", "")}`),
    shortcut,
    variant: "default" as const,
  };
}

export { useSourceNavigationCommands };
