import { BetweenVerticalStart, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  selectLoopPlaybackEnabledDefault,
  selectSegmentPlaybackEnabledDefault,
} from "@/app/store/slices/preferences-slice";

function usePlaybackPreferenceCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const loop = useAppSelector(selectLoopPlaybackEnabledDefault);
  const followSegment = useAppSelector(selectSegmentPlaybackEnabledDefault);
  const labels = {
    loopPlaybackEnabledDefault: t("settings.options.commandLabels.loop"),
    segmentPlaybackEnabledDefault: t("settings.options.commandLabels.followSegment"),
  };

  return (
    [
      {
        checked: loop,
        icon: <Repeat aria-hidden="true" />,
        key: "loopPlaybackEnabledDefault",
        id: "preference-loop-playback" as const,
      },
      {
        checked: followSegment,
        icon: <BetweenVerticalStart aria-hidden="true" />,
        key: "segmentPlaybackEnabledDefault",
        id: "preference-segment-playback" as const,
      },
    ] as const
  ).map(({ checked, icon, id, key }) => ({
    checked,
    enabled: true,
    icon,
    run() {
      dispatch(preferenceChanged({ key, enabled: !checked }));
    },
    id,
    label: labels[key],
    searchTerms: commandSearchTerms(`${labels[key]}|preference|setting`),
    variant: "default" as const,
  }));
}

export { usePlaybackPreferenceCommands };
