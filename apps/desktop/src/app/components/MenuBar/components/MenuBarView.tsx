import { Monitor, Moon, Sun, ZoomIn } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  MenubarContent,
  MenubarGroup,
  MenubarIcon,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";

import { getPrimaryColorCommandId, getThemeCommandId } from "@/app/commands/appearance";
import {
  ApplicationCommandIcon,
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
  ApplicationCommandShortcut,
} from "@/app/components/ApplicationCommandMenuItem";
import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectPrimaryColor,
  selectThemePreference,
  selectUiScalePercent,
} from "@/app/store/slices/preferences-slice";
import { PRIMARY_COLORS, resolvePrimaryColor } from "@/app/theme/theme";

const themeIcons = {
  system: <Monitor aria-hidden="true" />,
  light: <Sun aria-hidden="true" />,
  dark: <Moon aria-hidden="true" />,
} as const;

function MenuBarView() {
  const { t } = useTranslation();

  return (
    <MenubarMenu value="view">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
          {t("app.labels.view")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenuBarViewContent />
      </MenubarContent>
    </MenubarMenu>
  );
}

function MenuBarViewContent() {
  const { t } = useTranslation();

  const preference = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const uiScalePercent = useAppSelector(selectUiScalePercent);

  const currentThemeIcon = themeIcons[preference];

  return (
    <>
      <MenubarGroup>
        <MenubarSub>
          <MenubarSubTrigger inset>
            <MenubarIcon>
              <ZoomIn aria-hidden="true" />
            </MenubarIcon>
            {t("app.labels.uiScaling")}
            <MenubarShortcut>{uiScalePercent}%</MenubarShortcut>
          </MenubarSubTrigger>
          <MenubarSubContent>
            {(["ui-scale-zoom-in", "ui-scale-zoom-out"] as const).map((commandId) => (
              <ApplicationCommandMenuItem asChild commandId={commandId} key={commandId}>
                <MenubarItem keepOpen>
                  <ApplicationCommandLabel />
                  <ApplicationCommandShortcut />
                </MenubarItem>
              </ApplicationCommandMenuItem>
            ))}
            <MenubarSeparator />
            <ApplicationCommandMenuItem asChild commandId="ui-scale-reset">
              <MenubarItem keepOpen variant="destructive">
                <ApplicationCommandLabel />
                <ApplicationCommandShortcut />
              </MenubarItem>
            </ApplicationCommandMenuItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger inset>
            <MenubarIcon>{currentThemeIcon}</MenubarIcon>
            {t("settings.labels.theme")}
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarRadioGroup value={preference}>
              {(["system", "light", "dark"] as const).map((theme) => (
                <ApplicationCommandMenuItem
                  asChild
                  commandId={getThemeCommandId(theme)}
                  key={theme}
                >
                  <MenubarRadioItem inset keepOpen value={theme}>
                    <ApplicationCommandLabel />
                    <MenubarIcon side="right">
                      <ApplicationCommandIcon />
                    </MenubarIcon>
                  </MenubarRadioItem>
                </ApplicationCommandMenuItem>
              ))}
            </MenubarRadioGroup>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSub>
          <MenubarSubTrigger inset>
            {/* <MenubarIcon>
              <ColorSample color={resolvePrimaryColor(displayedPrimaryColor)} />
            </MenubarIcon> */}
            {t("settings.labels.color")}
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarRadioGroup value={primaryColor}>
              {PRIMARY_COLORS.map((color) => (
                <ApplicationCommandMenuItem
                  asChild
                  commandId={getPrimaryColorCommandId(color)}
                  key={color}
                >
                  <MenubarRadioItem inset keepOpen value={color}>
                    <ApplicationCommandLabel />
                    <MenubarShortcut className="flex items-center gap-2">
                      <span className="font-mono">{resolvePrimaryColor(color).toUpperCase()}</span>
                      <ApplicationCommandIcon />
                    </MenubarShortcut>
                  </MenubarRadioItem>
                </ApplicationCommandMenuItem>
              ))}
              {/* <MenubarSub>
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
              </MenubarSub> */}
            </MenubarRadioGroup>
          </MenubarSubContent>
        </MenubarSub>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="reset-view-settings">
          <MenubarItem inset keepOpen variant="destructive">
            <MenubarIcon>
              <ApplicationCommandIcon />
            </MenubarIcon>
            <ApplicationCommandLabel />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
    </>
  );
}

export { MenuBarView, MenuBarViewContent };
