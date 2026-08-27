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
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuItemIcon,
  MenuItemLabel,
  MenuItemSuffix,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";

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

  return (
    <Menu
      modal={false}
      open={navigation.open}
      onOpenChange={(isOpen) => {
        if (!isOpen) clearPreview();
        navigation.onOpenChange(isOpen);
      }}
    >
      <MenuTrigger
        asChild
        onPointerEnter={navigation.onTriggerPointerEnter}
        onPointerLeave={navigation.onTriggerPointerLeave}
      >
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          {t("app.topBarMenus.view")}
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuSub>
          <MenuSubTrigger>
            <MenuItemIcon>
              <CurrentThemeIcon className="size-3" aria-label={t(`theme.${preference}`)} />
            </MenuItemIcon>
            <MenuItemLabel>{t("app.topBarMenus.theme")}</MenuItemLabel>
          </MenuSubTrigger>
          <MenuSubContent>
            {(["system", "light", "dark"] as const).map((value) => {
              const Icon = themeIcons[value];
              return (
                <MenuItem
                  key={value}
                  selected={value === preference}
                  onSelect={(event) => {
                    event.preventDefault();
                    dispatch(themePreferenceChanged(value));
                  }}
                >
                  <MenuItemIcon>
                    <Icon className="size-3" aria-hidden="true" />
                  </MenuItemIcon>
                  <MenuItemLabel>{t(`theme.${value}`)}</MenuItemLabel>
                </MenuItem>
              );
            })}
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger>
            <MenuItemIcon>
              <ColorSample color={displayedPrimaryColor} />
            </MenuItemIcon>
            <MenuItemLabel>{t("app.topBarMenus.color")}</MenuItemLabel>
          </MenuSubTrigger>
          <MenuSubContent>
            {PRIMARY_COLORS.map((color) => (
              <MenuItem
                key={color}
                selected={color === primaryColorKey}
                onSelect={(event) => {
                  event.preventDefault();
                  dispatch(primaryColorChanged(color));
                }}
              >
                <MenuItemIcon>
                  <ColorSample color={color} selected={color === primaryColorKey} />
                </MenuItemIcon>
                <MenuItemLabel>{t(`themeColor.${color}`)}</MenuItemLabel>
                <MenuItemSuffix className="font-mono">
                  {resolvePrimaryColor(color).toUpperCase()}
                </MenuItemSuffix>
              </MenuItem>
            ))}
            <MenuSub>
              <MenuSubTrigger
                selected={primaryColorKey === CUSTOM_PRIMARY_COLOR}
                onClick={() => {
                  setPreviewColor(null);
                  dispatch(primaryColorChanged(customPrimaryColor));
                }}
              >
                <MenuItemIcon>
                  <ColorSample
                    color={displayedCustomColor}
                    selected={primaryColorKey === CUSTOM_PRIMARY_COLOR}
                  />
                </MenuItemIcon>
                <MenuItemLabel>{t("themeColor.custom")}</MenuItemLabel>
                <MenuItemSuffix className="font-mono">
                  {displayedCustomColor.toUpperCase()}
                </MenuItemSuffix>
              </MenuSubTrigger>
              <MenuSubContent>
                <CustomColorPickerPanel
                  previewColor={previewColor}
                  onPreviewChange={setPreviewColor}
                  onClose={closeMenu}
                />
              </MenuSubContent>
            </MenuSub>
          </MenuSubContent>
        </MenuSub>
      </MenuContent>
    </Menu>
  );
}
