import { useTranslation } from "react-i18next";

import { ColorSample } from "@/components/ui/color";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { primaryColorChanged } from "@/app/store/slices/preferences-slice";
import { PRIMARY_COLORS, resolvePrimaryColor } from "@/app/theme/theme";

type PrimaryColor = (typeof PRIMARY_COLORS)[number];

function getPrimaryColorCommandId(color: PrimaryColor) {
  return `primary-color-${color}` as const;
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

  return PRIMARY_COLORS.map((color) => ({
    checked: currentColor === color,
    enabled: true,
    icon: <ColorSample aria-hidden="true" color={resolvePrimaryColor(color)} />,
    run() {
      dispatch(primaryColorChanged(color));
    },
    id: getPrimaryColorCommandId(color),
    label: labels[color],
    searchTerms: [labels[color], "color", "accent"],
    variant: "default" as const,
  }));
}

export { getPrimaryColorCommandId, usePrimaryColorCommands };
