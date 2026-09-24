import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  MenubarContent,
  MenubarGroup,
  MenubarIcon,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

import {
  ApplicationCommandIcon,
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";

function MenuBarHelp() {
  const { t } = useTranslation();

  return (
    <MenubarMenu value="help">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
          {t("app.labels.help")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenuBarHelpContent />
      </MenubarContent>
    </MenubarMenu>
  );
}

function MenuBarHelpContent() {
  return (
    <>
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="open-changelog">
          <MenubarItem inset>
            <MenubarIcon>
              <ApplicationCommandIcon />
            </MenubarIcon>
            <ApplicationCommandLabel />
          </MenubarItem>
        </ApplicationCommandMenuItem>
        <ApplicationCommandMenuItem asChild commandId="check-for-updates">
          <MenubarItem inset keepOpen>
            <MenubarIcon>
              <ApplicationCommandIcon />
            </MenubarIcon>
            <ApplicationCommandLabel />
          </MenubarItem>
        </ApplicationCommandMenuItem>
        <ApplicationCommandMenuItem asChild commandId="open-project-page">
          <MenubarItem inset>
            <MenubarIcon>
              <ApplicationCommandIcon />
            </MenubarIcon>
            <ApplicationCommandLabel />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="show-logs">
          <MenubarItem inset>
            <MenubarIcon>
              <ApplicationCommandIcon />
            </MenubarIcon>
            <ApplicationCommandLabel />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="support-project">
          <MenubarItem inset>
            <MenubarIcon>
              <ApplicationCommandIcon />
            </MenubarIcon>
            <ApplicationCommandLabel />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="open-release-page">
          <MenubarItem inset>
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

export { MenuBarHelp, MenuBarHelpContent };
