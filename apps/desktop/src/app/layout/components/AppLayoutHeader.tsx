import { useTranslation } from "react-i18next";

import { AppCommandCenter } from "@/app/components/AppCommandCenter";
import { MenuBar } from "@/app/components/MenuBar";
import { TitleBar, TitleBarWindowActions } from "@/app/components/TitleBar";
import { SourceNavigation } from "@/features/source";

import { AppLayoutControls } from "./AppLayoutControls";

function AppLayoutHeader() {
  const { t } = useTranslation();

  return (
    <TitleBar className="w-full justify-between">
      <div className="flex h-full flex-1 gap-2">
        <div className="flex h-full items-center gap-2 px-3 text-left">
          <img alt="" className="size-5" src="/logo-symbol.svg" />
          <span className="text-sm font-semibold tracking-wide whitespace-nowrap text-foreground/80">
            {t("common.labels.brand")}
          </span>
        </div>

        <MenuBar />
      </div>

      <div className="flex max-w-lg flex-1/2 justify-center px-15">
        <AppCommandCenter>
          <SourceNavigation className="-mx-15 mr-1" />
        </AppCommandCenter>
      </div>

      <div className="flex h-full flex-1 justify-end gap-3">
        <AppLayoutControls />
        <TitleBarWindowActions />
      </div>
    </TitleBar>
  );
}

export { AppLayoutHeader };
