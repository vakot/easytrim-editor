import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";

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

import type { MenuNavigation } from "../../types";

import { ColorSample } from "./components/ColorSample";
import { CustomColorPickerPanel } from "./components/CustomColorPickerPanel";

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
          <MenuSubTrigger
            icon={<CurrentThemeIcon className="size-3" aria-label={t(`theme.${preference}`)} />}
          >
            {t("app.topBarMenus.theme")}
          </MenuSubTrigger>
          <MenuSubContent>
            {(["system", "light", "dark"] as const).map((value) => {
              const Icon = themeIcons[value];
              return (
                <MenuItem
                  key={value}
                  icon={<Icon className="size-3" aria-hidden="true" />}
                  selected={value === preference}
                  onSelect={(event) => {
                    event.preventDefault();
                    dispatch(themePreferenceChanged(value));
                  }}
                >
                  {t(`theme.${value}`)}
                </MenuItem>
              );
            })}
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger icon={<ColorSample color={displayedPrimaryColor} />}>
            {t("app.topBarMenus.color")}
          </MenuSubTrigger>
          <MenuSubContent>
            {PRIMARY_COLORS.map((color) => (
              <MenuItem
                key={color}
                icon={<ColorSample color={color} selected={color === primaryColorKey} />}
                selected={color === primaryColorKey}
                suffix={
                  <span className="font-mono">{resolvePrimaryColor(color).toUpperCase()}</span>
                }
                onSelect={(event) => {
                  event.preventDefault();
                  dispatch(primaryColorChanged(color));
                }}
              >
                {t(`themeColor.${color}`)}
              </MenuItem>
            ))}
            <MenuSub>
              <MenuSubTrigger
                icon={
                  <ColorSample
                    color={displayedCustomColor}
                    selected={primaryColorKey === CUSTOM_PRIMARY_COLOR}
                  />
                }
                selected={primaryColorKey === CUSTOM_PRIMARY_COLOR}
                suffix={<span className="font-mono">{displayedCustomColor.toUpperCase()}</span>}
                onClick={() => {
                  setPreviewColor(null);
                  dispatch(primaryColorChanged(customPrimaryColor));
                }}
              >
                {t("themeColor.custom")}
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
