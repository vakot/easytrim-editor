import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ColorSample, SpectrumWheel } from "@/components/ui/color";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  customPrimaryColorChanged,
  primaryColorChanged,
  selectCustomPrimaryColor,
  selectPrimaryColor,
  selectPrimaryColorKey,
  selectThemePreference,
  themePreferenceChanged,
} from "@/app/store/slices/theme-slice";
import {
  CUSTOM_PRIMARY_COLOR,
  isCustomPrimaryColor,
  PRIMARY_COLORS,
  type PrimaryColor,
  resolvePrimaryColor,
} from "@/app/theme/theme";
import { useTheme } from "@/app/theme/useTheme";

import type { MenuNavigation } from "../types";

const themeIcons = { system: Monitor, light: Sun, dark: Moon } as const;

interface ContextMenuViewProps {
  navigation: MenuNavigation;
}

export function ContextMenuView({ navigation }: ContextMenuViewProps) {
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
      onOpenChange={(isOpen) => {
        if (!isOpen) clearPreview();
        navigation.onOpenChange(isOpen);
      }}
      open={navigation.open}
    >
      <MenuTrigger
        asChild
        onPointerEnter={navigation.onTriggerPointerEnter}
        onPointerLeave={navigation.onTriggerPointerLeave}
      >
        <Button
          className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
          size="xs"
          type="button"
          variant="ghost"
        >
          {t("app.topBarMenus.view")}
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuSub>
          <MenuSubTrigger
            icon={<CurrentThemeIcon aria-label={t(`theme.${preference}`)} className="size-3" />}
          >
            {t("app.topBarMenus.theme")}
          </MenuSubTrigger>
          <MenuSubContent>
            {(["system", "light", "dark"] as const).map((value) => {
              const Icon = themeIcons[value];
              return (
                <MenuItem
                  icon={<Icon aria-hidden="true" className="size-3" />}
                  key={value}
                  onSelect={(event) => {
                    event.preventDefault();
                    dispatch(themePreferenceChanged(value));
                  }}
                  selected={value === preference}
                >
                  {t(`theme.${value}`)}
                </MenuItem>
              );
            })}
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger icon={<ColorSample color={resolvePrimaryColor(displayedPrimaryColor)} />}>
            {t("app.topBarMenus.color")}
          </MenuSubTrigger>
          <MenuSubContent>
            {PRIMARY_COLORS.map((color) => (
              <MenuItem
                icon={
                  <ColorSample
                    color={resolvePrimaryColor(color)}
                    selected={color === primaryColorKey}
                  />
                }
                key={color}
                onSelect={(event) => {
                  event.preventDefault();
                  dispatch(primaryColorChanged(color));
                }}
                selected={color === primaryColorKey}
                suffix={
                  <span className="font-mono">{resolvePrimaryColor(color).toUpperCase()}</span>
                }
              >
                {t(`themeColor.${color}`)}
              </MenuItem>
            ))}
            <MenuSub>
              <MenuSubTrigger
                icon={
                  <ColorSample
                    color={resolvePrimaryColor(displayedCustomColor)}
                    selected={primaryColorKey === CUSTOM_PRIMARY_COLOR}
                  />
                }
                onClick={() => {
                  setPreviewColor(null);
                  dispatch(primaryColorChanged(customPrimaryColor));
                }}
                selected={primaryColorKey === CUSTOM_PRIMARY_COLOR}
                suffix={<span className="font-mono">{displayedCustomColor.toUpperCase()}</span>}
              >
                {t("themeColor.custom")}
              </MenuSubTrigger>
              <MenuSubContent>
                <CustomColorPickerPanel
                  onClose={closeMenu}
                  onPreviewChange={setPreviewColor}
                  previewColor={previewColor}
                />
              </MenuSubContent>
            </MenuSub>
          </MenuSubContent>
        </MenuSub>
      </MenuContent>
    </Menu>
  );
}

interface CustomColorPickerPanelProps {
  onClose: () => void;
  onPreviewChange: (color: PrimaryColor | null) => void;
  previewColor: PrimaryColor | null;
}

function CustomColorPickerPanel({
  onClose,
  onPreviewChange,
  previewColor,
}: CustomColorPickerPanelProps) {
  const { t } = useTranslation();
  const { previewPrimaryColor } = useTheme();
  const dispatch = useAppDispatch();
  const customPrimaryColor = useAppSelector(selectCustomPrimaryColor);

  const [hexValue, setHexValue] = useState<string>(customPrimaryColor.slice(1));
  const selectedColor = resolvePrimaryColor(previewColor ?? customPrimaryColor);

  const preview = (color: PrimaryColor) => {
    onPreviewChange(color);
    setHexValue(resolvePrimaryColor(color).slice(1));
    previewPrimaryColor(color);
  };

  const commit = (color: PrimaryColor) => {
    onPreviewChange(null);
    setHexValue(resolvePrimaryColor(color).slice(1));
    if (isCustomPrimaryColor(color)) dispatch(customPrimaryColorChanged(color));
  };

  const cancel = () => {
    onPreviewChange(null);
    setHexValue(customPrimaryColor.slice(1));
    previewPrimaryColor(null);
  };

  const updateHexValue = (value: string) => {
    setHexValue(value);
    const color = `#${value}`;
    if (isCustomPrimaryColor(color)) commit(color);
  };

  return (
    <div className="w-auto space-y-3 p-2" onPointerMove={(event) => event.stopPropagation()}>
      <SpectrumWheel
        aria-label={t("themeColor.spectrum")}
        color={selectedColor}
        onCancel={cancel}
        onCommit={commit}
        onPreview={preview}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{t("themeColor.custom")}</span>
        <div className="flex h-6 w-15 items-center rounded-lg border border-input bg-transparent px-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none shrink-0 font-mono text-xs text-muted-foreground"
            data-slot="hex-prefix"
          >
            #
          </span>
          <Input
            aria-label={`${t("themeColor.custom")} hex`}
            className="h-full w-auto min-w-0 flex-1 rounded-none border-0 px-0 py-0 font-mono text-xs text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
            maxLength={6}
            onChange={(event) =>
              updateHexValue(event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
            }
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const color = `#${hexValue}`;
              if (isCustomPrimaryColor(color)) commit(color);
              onClose();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            pattern="[0-9a-fA-F]{6}"
            spellCheck={false}
            value={hexValue}
          />
        </div>
      </div>
    </div>
  );
}
