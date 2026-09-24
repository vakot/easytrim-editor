import { useTranslation } from "react-i18next";

import { AppCommandCenter } from "@/app/components/AppCommandCenter";
import { MenuBar } from "@/app/components/MenuBar";
import { TitleBar, TitleBarWindowActions } from "@/app/components/TitleBar";

import { AppLayoutControls } from "./AppLayoutControls";

function AppLayoutHeader() {
  const { t } = useTranslation();

  return (
    <TitleBar className="w-full justify-between">
      <div className="flex h-full gap-2">
        <div className="flex h-full items-center gap-2 px-3 text-left">
          <img alt="" className="size-5" src="/logo-symbol.svg" />
          <span className="text-sm font-semibold tracking-wide text-foreground/80">
            {t("common.labels.brand")}
          </span>
        </div>

        <MenuBar />
      </div>

      <div className="absolute top-1/2 left-1/2 flex h-full -translate-1/2 items-center px-2">
        <AppCommandCenter />
      </div>

      <div className="flex h-full gap-3">
        <AppLayoutControls />
        <TitleBarWindowActions />
      </div>
    </TitleBar>
  );
}

export { AppLayoutHeader };
