import { LayoutTemplate, PanelsLeftBottom } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { layoutDensityChanged, selectLayoutDensity } from "@/app/store/slices/preferences-slice";

function useLayoutDensityCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const selected = useAppSelector(selectLayoutDensity);
  const labels = {
    default: t("app.options.layoutDensities.default"),
    compact: t("app.options.layoutDensities.compact"),
  };

  return (["default", "compact"] as const).map((density) => ({
    checked: selected === density,
    enabled: true,
    icon:
      density === "default" ? (
        <LayoutTemplate aria-hidden="true" className="-scale-x-100 -rotate-90" />
      ) : (
        <PanelsLeftBottom aria-hidden="true" />
      ),
    run() {
      dispatch(layoutDensityChanged(density));
    },
    id: `layout-density-${density}` as const,
    label: labels[density],
    searchTerms: commandSearchTerms(`${labels[density]}|layout|density`),
    variant: "default" as const,
  }));
}

export { useLayoutDensityCommands };
