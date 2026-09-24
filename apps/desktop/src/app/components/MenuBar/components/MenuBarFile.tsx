import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

import {
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
  ApplicationCommandShortcut,
} from "@/app/components/ApplicationCommandMenuItem";

function MenuBarFile() {
  const { t } = useTranslation();

  return (
    <MenubarMenu value="file">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
          {t("app.labels.file")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenuBarFileContent />
      </MenubarContent>
    </MenubarMenu>
  );
}

function MenuBarFileContent() {
  return (
    <>
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="open-file">
          <MenubarItem>
            <ApplicationCommandLabel />
            <ApplicationCommandShortcut />
          </MenubarItem>
        </ApplicationCommandMenuItem>
        <ApplicationCommandMenuItem asChild commandId="open-folder">
          <MenubarItem>
            <ApplicationCommandLabel />
            <ApplicationCommandShortcut />
          </MenubarItem>
        </ApplicationCommandMenuItem>
        <ApplicationCommandMenuItem asChild commandId="close-file">
          <MenubarItem>
            <ApplicationCommandLabel />
            <ApplicationCommandShortcut />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="save-lossless-cut">
          <MenubarItem>
            <ApplicationCommandLabel />
            <ApplicationCommandShortcut />
          </MenubarItem>
        </ApplicationCommandMenuItem>
        <ApplicationCommandMenuItem asChild commandId="optimized-export">
          <MenubarItem>
            <ApplicationCommandLabel />
            <ApplicationCommandShortcut />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="delete-file">
          <MenubarItem>
            <ApplicationCommandLabel />
            <ApplicationCommandShortcut />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
    </>
  );
}

export { MenuBarFile, MenuBarFileContent };
