import { Check, List, Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ColorSample, SpectrumWheel } from "@/components/ui/color";
import { Input } from "@/components/ui/input";
import {
  MenubarContent,
  MenubarGroup,
  MenubarIcon,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";

import type { ActivityFeedView } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  activityFeedViewChanged,
  selectActivityFeedView,
} from "@/app/store/slices/preferences-slice";
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
  type ThemePreference,
} from "@/app/theme/theme";
import { useTheme } from "@/app/theme/useTheme";

const themeIcons = {
  system: <Monitor aria-hidden="true" />,
  light: <Sun aria-hidden="true" />,
  dark: <Moon aria-hidden="true" />,
} as const;

interface MenuBarViewProps {
  onClose: () => void;
}

export function MenuBarView({ onClose }: MenuBarViewProps) {
  const { t } = useTranslation();
  const { previewPrimaryColor } = useTheme();
  const dispatch = useAppDispatch();
  const [previewColor, setPreviewColor] = useState<PrimaryColor | null>(null);

  const preference = useAppSelector(selectThemePreference);
  const activityFeedView = useAppSelector(selectActivityFeedView);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const primaryColorKey = useAppSelector(selectPrimaryColorKey);
  const customPrimaryColor = useAppSelector(selectCustomPrimaryColor);

  const currentThemeIcon = themeIcons[preference];
  const displayedPrimaryColor = previewColor ?? primaryColor;
  const displayedCustomColor = previewColor ?? customPrimaryColor;

  const colorLabels: Record<(typeof PRIMARY_COLORS)[number], string> = {
    amber: t("settings.options.colors.amber"),
    blue: t("settings.options.colors.blue"),
    emerald: t("settings.options.colors.emerald"),
    rose: t("settings.options.colors.rose"),
    violet: t("settings.options.colors.violet"),
  };

  const themeLabels: Record<keyof typeof themeIcons, string> = {
    dark: t("settings.options.themes.dark"),
    light: t("settings.options.themes.light"),
    system: t("settings.options.themes.system"),
  };

  const activityFeedViewLabels: Record<ActivityFeedView, string> = {
    compact: t("settings.options.activityFeedViews.compact"),
    default: t("settings.options.activityFeedViews.default"),
  };

  const clearPreview = () => {
    setPreviewColor(null);
    previewPrimaryColor(null);
  };

  const closeMenu = () => {
    clearPreview();
    onClose();
  };

  return (
    <MenubarMenu value="view">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="xs" type="button" variant="ghost">
          {t("app.labels.view")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenubarGroup>
          <MenubarSub>
            <MenubarSubTrigger inset>
              <MenubarIcon>
                <List aria-hidden="true" />
              </MenubarIcon>
              {t("settings.labels.activityFeedView")}
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarRadioGroup
                onValueChange={(view) =>
                  dispatch(activityFeedViewChanged(view as ActivityFeedView))
                }
                value={activityFeedView}
              >
                {(["default", "compact"] as const).map((view) => (
                  <MenubarRadioItem inset keepOpen key={view} value={view}>
                    {activityFeedViewLabels[view]}
                  </MenubarRadioItem>
                ))}
              </MenubarRadioGroup>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger inset>
              <MenubarIcon>{currentThemeIcon}</MenubarIcon>
              {t("settings.labels.theme")}
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarRadioGroup
                onValueChange={(theme) =>
                  dispatch(themePreferenceChanged(theme as ThemePreference))
                }
                value={preference}
              >
                {(["system", "light", "dark"] as const).map((theme) => (
                  <MenubarRadioItem inset keepOpen key={theme} value={theme}>
                    {themeLabels[theme]}
                    <MenubarIcon side="right">{themeIcons[theme]}</MenubarIcon>
                  </MenubarRadioItem>
                ))}
              </MenubarRadioGroup>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger inset>
              <MenubarIcon>
                <ColorSample color={resolvePrimaryColor(displayedPrimaryColor)} />
              </MenubarIcon>
              {t("settings.labels.color")}
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarRadioGroup
                onValueChange={(color) => dispatch(primaryColorChanged(color as PrimaryColor))}
                value={primaryColor}
              >
                {PRIMARY_COLORS.map((color) => (
                  <MenubarRadioItem inset keepOpen key={color} value={color}>
                    {colorLabels[color]}
                    <MenubarShortcut className="flex items-center gap-2">
                      <span className="font-mono">{resolvePrimaryColor(color).toUpperCase()}</span>
                      <ColorSample color={resolvePrimaryColor(color)} />
                    </MenubarShortcut>
                  </MenubarRadioItem>
                ))}
                <MenubarSub>
                  <MenubarSubTrigger
                    inset
                    onClick={() => {
                      setPreviewColor(null);
                      dispatch(primaryColorChanged(customPrimaryColor));
                    }}
                  >
                    {primaryColorKey === CUSTOM_PRIMARY_COLOR && (
                      <MenubarIcon>
                        <Check aria-hidden="true" />
                      </MenubarIcon>
                    )}
                    {t("settings.options.colors.custom")}
                    <MenubarShortcut className="flex items-center gap-2">
                      <span className="font-mono">{displayedCustomColor.toUpperCase()}</span>
                      <ColorSample color={resolvePrimaryColor(displayedCustomColor)} />
                    </MenubarShortcut>
                  </MenubarSubTrigger>
                  <MenubarSubContent>
                    <CustomColorPickerPanel
                      onClose={closeMenu}
                      onPreviewChange={setPreviewColor}
                      previewColor={previewColor}
                    />
                  </MenubarSubContent>
                </MenubarSub>
              </MenubarRadioGroup>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
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
        aria-label={t("settings.accessibility.colorSpectrum")}
        color={selectedColor}
        onCancel={cancel}
        onCommit={commit}
        onPreview={preview}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{t("settings.options.colors.custom")}</span>
        <div className="flex h-6 w-15 items-center rounded-lg border border-input bg-transparent px-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span
            aria-hidden="true"
            className="pointer-events-none shrink-0 font-mono text-xs text-muted-foreground select-none"
            data-slot="hex-prefix"
          >
            #
          </span>
          <Input
            aria-label={t("settings.accessibility.customColorHex")}
            className="h-full w-auto min-w-0 flex-1 rounded-none border-0 p-0 font-mono text-xs text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
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
