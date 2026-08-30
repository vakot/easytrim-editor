import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Menubar } from "@/components/ui/menubar";

import { diagnostics } from "@/lib/diagnostics";

import { MenuBarFile } from "./components/MenuBarFile";
import { MenuBarHelp } from "./components/MenuBarHelp";
import { MenuBarQueue } from "./components/MenuBarQueue";
import { MenuBarSettings } from "./components/MenuBarSettings";
import { MenuBarView } from "./components/MenuBarView";

export function MenuBar() {
  const { t } = useTranslation();
  const [menuVersion, setMenuVersion] = useState(0);

  return (
    <Menubar
      aria-label={t("app.accessibility.menus")}
      className="h-full rounded-none border-0 bg-transparent p-0"
      key={menuVersion}
      onValueChange={(value) => {
        diagnostics.event(value ? "menu.opened.changed" : "menu.closed.changed", {
          data: value ? { menu: value } : { menu: "none" },
          origin: { type: "menu", id: value || "menubar" },
        });
      }}
    >
      <MenuBarFile />
      <MenuBarView onClose={() => setMenuVersion((version) => version + 1)} />
      <MenuBarQueue />
      <MenuBarSettings />
      <MenuBarHelp />
    </Menubar>
  );
}
