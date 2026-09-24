import { Menu } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Menubar,
  MenubarContent,
  MenubarMenu,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";

import { diagnostics } from "@/lib/diagnostics";

import { MenuBarFile, MenuBarFileContent } from "./components/MenuBarFile";
import { MenuBarHelp, MenuBarHelpContent } from "./components/MenuBarHelp";
import { MenuBarQueue, MenuBarQueueContent } from "./components/MenuBarQueue";
import { MenuBarSettings, MenuBarSettingsContent } from "./components/MenuBarSettings";
import { MenuBarView, MenuBarViewContent } from "./components/MenuBarView";

type MenuId = "file" | "view" | "queue" | "settings" | "help";

function reportMenuChange(value: MenuId | "") {
  diagnostics.event(value ? "menu.opened.changed" : "menu.closed.changed", {
    data: { menu: value || "none" },
    origin: { type: "menu", id: value || "menubar" },
  });
}

interface CompactMenuSubProps {
  children: React.ReactNode;
  id: MenuId;
  label: React.ReactNode;
}

function CompactMenuSub({ children, id, label }: CompactMenuSubProps) {
  return (
    <MenubarSub
      onOpenChange={(open) => {
        reportMenuChange(open ? id : "");
      }}
    >
      <MenubarSubTrigger>{label}</MenubarSubTrigger>

      <MenubarSubContent>{children}</MenubarSubContent>
    </MenubarSub>
  );
}

function MenuBar() {
  const { t } = useTranslation();
  const [menuVersion, setMenuVersion] = useState(0);

  const closeMenu = () => {
    setMenuVersion((version) => version + 1);
  };

  return (
    <>
      <div className="hidden xl:block">
        <Menubar
          aria-label={t("app.accessibility.menus")}
          className="h-full rounded-none border-0 bg-transparent p-0"
          key={menuVersion}
          onValueChange={(value) => reportMenuChange(value as MenuId | "")}
        >
          <MenuBarFile />
          <MenuBarView onClose={closeMenu} />
          <MenuBarQueue />
          <MenuBarSettings />
          <MenuBarHelp />
        </Menubar>
      </div>

      <div className="block xl:hidden">
        <Menubar className="h-full rounded-none border-0 bg-transparent p-0">
          <MenubarMenu value="menu">
            <MenubarTrigger asChild>
              <Button aria-label={t("app.accessibility.menus")} size="icon-sm" variant="ghost">
                <Menu aria-hidden="true" />
              </Button>
            </MenubarTrigger>

            <MenubarContent align="start">
              <CompactMenuSub id="file" label={t("app.labels.file")}>
                <MenuBarFileContent />
              </CompactMenuSub>

              <CompactMenuSub id="view" label={t("app.labels.view")}>
                <MenuBarViewContent onClose={closeMenu} />
              </CompactMenuSub>

              <CompactMenuSub id="queue" label={t("queue.labels.title")}>
                <MenuBarQueueContent />
              </CompactMenuSub>

              <CompactMenuSub id="settings" label={t("settings.labels.title")}>
                <MenuBarSettingsContent />
              </CompactMenuSub>

              <CompactMenuSub id="help" label={t("app.labels.help")}>
                <MenuBarHelpContent />
              </CompactMenuSub>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>
    </>
  );
}

export { MenuBar };
