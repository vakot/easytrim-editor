import { Merge } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  selectMergeAudioEnabledDefault,
} from "@/app/store/slices/preferences-slice";

function useAudioPreferenceCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectMergeAudioEnabledDefault);
  const label = t("settings.options.commandLabels.mergeAudio");
  return [
    {
      checked,
      enabled: true,
      icon: <Merge aria-hidden="true" />,
      run() {
        dispatch(preferenceChanged({ key: "mergeAudioEnabledDefault", enabled: !checked }));
      },
      id: "preference-merge-audio" as const,
      label,
      searchTerms: commandSearchTerms(`${label}|preference|setting`),
      variant: "default" as const,
    },
  ] as const;
}

export { useAudioPreferenceCommands };
