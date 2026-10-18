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

function MenuBarEdit() {
  const { t } = useTranslation();

  return (
    <MenubarMenu value="edit">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
          {t("app.menu.edit")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenuBarEditContent />
      </MenubarContent>
    </MenubarMenu>
  );
}

function MenuBarEditContent() {
  return (
    <>
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="undo">
          <MenubarItem>
            <ApplicationCommandLabel />
            <ApplicationCommandShortcut />
          </MenubarItem>
        </ApplicationCommandMenuItem>
        <ApplicationCommandMenuItem asChild commandId="redo">
          <MenubarItem>
            <ApplicationCommandLabel />
            <ApplicationCommandShortcut />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
      <MenubarSeparator />
    </>
  );
}

export { MenuBarEdit, MenuBarEditContent };
