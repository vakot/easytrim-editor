import { useTranslation } from "react-i18next";

import type { AlertDialogScope } from "@/components/ui/alert-dialog";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { type BuiltInPresetId, getPresetDisplayName } from "@/app/store/lib/export-presets";
import { useAppDispatch } from "@/app/store/redux-hooks";
import { exportPresetDeleted, exportPresetSelected } from "@/app/store/slices/export-presets-slice";

import { usePresetDeleteDialog } from "./PresetDeleteDialogContext";

function PresetDeleteDialogContent({
  __scopeAlertDialog,
}: {
  __scopeAlertDialog?: AlertDialogScope;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { preset } = usePresetDeleteDialog();
  const builtInNames: Record<BuiltInPresetId, string> = {
    "hevc-nvenc-p1": t("export.preset.builtIn.p1.name"),
    "hevc-nvenc-p2": t("export.preset.builtIn.p2.name"),
    "hevc-nvenc-p3": t("export.preset.builtIn.p3.name"),
    "hevc-nvenc-p4": t("export.preset.builtIn.p4.name"),
    "hevc-nvenc-p5": t("export.preset.builtIn.p5.name"),
    "hevc-nvenc-p6": t("export.preset.builtIn.p6.name"),
    "hevc-nvenc-p7": t("export.preset.builtIn.p7.name"),
  };

  function deletePreset() {
    if (preset) {
      dispatch(exportPresetSelected(preset.id));
      dispatch(exportPresetDeleted());
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle __scopeAlertDialog={__scopeAlertDialog}>
          {t("export.preset.delete.title")}
        </AlertDialogTitle>
        <AlertDialogDescription __scopeAlertDialog={__scopeAlertDialog}>
          {t("export.preset.delete.description", {
            name: preset ? getPresetDisplayName(preset, (id) => builtInNames[id]) : "",
          })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel __scopeAlertDialog={__scopeAlertDialog}>
          {t("common.actions.cancel")}
        </AlertDialogCancel>
        <AlertDialogAction
          __scopeAlertDialog={__scopeAlertDialog}
          onClick={deletePreset}
          variant="destructive"
        >
          {t("export.preset.actions.delete")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { PresetDeleteDialogContent };
