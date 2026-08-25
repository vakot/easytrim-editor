import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  primaryColorChanged,
  selectCustomPrimaryColor,
  selectPrimaryColor,
  selectPrimaryColorKey,
  selectThemePreference,
  themePreferenceChanged,
} from "@/app/store/slices/theme-slice";
import {
  CUSTOM_PRIMARY_COLOR,
  PRIMARY_COLORS,
  type PrimaryColor,
  resolvePrimaryColor,
} from "@/app/theme/theme";
import { useTheme } from "@/app/theme/use-theme";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";

import { ColorSample } from "./components/ColorSample";
import { CustomColorPickerPanel } from "./components/CustomColorPickerPanel";
import type { MenuNavigation } from "../../types";

const themeIcons = { system: Monitor, light: Sun, dark: Moon } as const;

interface ViewMenuProps {
  navigation: MenuNavigation;
}

export function ViewMenu({ navigation }: ViewMenuProps) {
  const { t } = useTranslation();
  const { previewPrimaryColor } = useTheme();
  const dispatch = useAppDispatch();
  const preference = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const primaryColorKey = useAppSelector(selectPrimaryColorKey);
  const customPrimaryColor = useAppSelector(selectCustomPrimaryColor);
  const [previewColor, setPreviewColor] = useState<PrimaryColor | null>(null);
  const CurrentThemeIcon = themeIcons[preference];
  const displayedPrimaryColor = previewColor ?? primaryColor;
  const displayedCustomColor = previewColor ?? customPrimaryColor;

  const clearPreview = () => {
    setPreviewColor(null);
    previewPrimaryColor(null);
  };

  const closeMenu = () => {
    clearPreview();
    navigation.onOpenChange(false);
  };

  const themeOptions: ContextMenuOption[] = (["system", "light", "dark"] as const).map((value) => {
    const Icon = themeIcons[value];
    return {
      id: `theme-${value}`,
      children: t(`theme.${value}`),
      icon: <Icon className="size-3" aria-hidden="true" />,
      selected: value === preference,
      shouldCloseOnClick: false,
      onSelect: () => dispatch(themePreferenceChanged(value)),
    };
  });

  const colorOptions: ContextMenuOption[] = [
    ...PRIMARY_COLORS.map((color) => ({
      id: `color-${color}`,
      icon: <ColorSample color={color} selected={color === primaryColorKey} />,
      children: t(`themeColor.${color}`),
      suffix: <span className="font-mono">{resolvePrimaryColor(color).toUpperCase()}</span>,
      selected: color === primaryColorKey,
      shouldCloseOnClick: false,
      onSelect: () => dispatch(primaryColorChanged(color)),
    })),
    {
      id: "color-custom",
      icon: (
        <ColorSample
          color={displayedCustomColor}
          selected={primaryColorKey === CUSTOM_PRIMARY_COLOR}
        />
      ),
      children: t("themeColor.custom"),
      suffix: <span className="font-mono">{displayedCustomColor.toUpperCase()}</span>,
      selected: primaryColorKey === CUSTOM_PRIMARY_COLOR,
      shouldCloseOnClick: false,
      onSelect: () => {
        setPreviewColor(null);
        dispatch(primaryColorChanged(customPrimaryColor));
      },
      options: [
        {
          id: "custom-color-picker",
          render: () => (
            <CustomColorPickerPanel
              previewColor={previewColor}
              onPreviewChange={setPreviewColor}
              onClose={closeMenu}
            />
          ),
        },
      ],
    },
  ];

  return (
    <ContextMenu
      open={navigation.open}
      onOpenChange={(isOpen) => {
        if (!isOpen) clearPreview();
        navigation.onOpenChange(isOpen);
      }}
      onTriggerPointerEnter={navigation.onTriggerPointerEnter}
      onTriggerPointerLeave={navigation.onTriggerPointerLeave}
      options={[
        {
          id: "theme",
          children: t("app.topBarMenus.theme"),
          icon: <CurrentThemeIcon className="size-3" aria-label={t(`theme.${preference}`)} />,
          shouldCloseOnClick: false,
          options: themeOptions,
        },
        {
          id: "color",
          children: t("app.topBarMenus.color"),
          icon: <ColorSample color={displayedPrimaryColor} />,
          shouldCloseOnClick: false,
          options: colorOptions,
        },
      ]}
    >
      {t("app.topBarMenus.view")}
    </ContextMenu>
  );
}
