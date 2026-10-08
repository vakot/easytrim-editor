import { FileX2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  selectStripMetadataOnExport,
} from "@/app/store/slices/preferences-slice";

function useStripMetadataCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectStripMetadataOnExport);
  const label = t("settings.preferences.stripMetadata.commandLabel");

  return {
    checked,
    enabled: true,
    icon: <FileX2 aria-hidden="true" />,
    run() {
      dispatch(preferenceChanged({ key: "stripMetadataOnExport", enabled: !checked }));
    },
    id: "preference-strip-metadata" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|export|metadata|chapters|preference|setting`),
    variant: "default" as const,
  };
}

export { useStripMetadataCommand };
