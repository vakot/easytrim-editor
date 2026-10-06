import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { primaryColorChanged } from "@/app/store/slices/preferences-slice";
import { PRIMARY_COLOR_PRESETS } from "@/app/theme/theme";
import { ColorSample } from "@/components/color";

function getPrimaryColorCommandId(id: (typeof PRIMARY_COLOR_PRESETS)[number]["id"]) {
  return `primary-color-${id}` as const;
}

function usePrimaryColorCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const currentColor = useAppSelector((state) => state.preferences.primaryColor);
  const labels = {
    amber: t("settings.options.colors.amber"),
    blue: t("settings.options.colors.blue"),
    emerald: t("settings.options.colors.emerald"),
    rose: t("settings.options.colors.rose"),
    violet: t("settings.options.colors.violet"),
  };

  return PRIMARY_COLOR_PRESETS.map((preset) => {
    const label = labels[preset.id];

    return {
      checked: currentColor === preset.color,
      enabled: true,
      icon: <ColorSample aria-hidden="true" color={preset.color} />,
      run() {
        dispatch(primaryColorChanged(preset.color));
      },
      id: getPrimaryColorCommandId(preset.id),
      label,
      searchTerms: [label, "color", "accent"],
      variant: "default" as const,
    };
  });
}

export { getPrimaryColorCommandId, usePrimaryColorCommands };
