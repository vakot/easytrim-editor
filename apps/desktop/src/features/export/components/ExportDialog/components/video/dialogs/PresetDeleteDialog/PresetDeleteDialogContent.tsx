import { useTranslation } from "react-i18next";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  type BuiltInPresetId,
  type ExportPreset,
  getPresetDisplayName,
} from "@/app/store/lib/export-presets";
import { useAppDispatch } from "@/app/store/redux-hooks";
import { exportPresetDeleted, exportPresetSelected } from "@/app/store/slices/export-presets-slice";

interface PresetDeleteDialogContentProps {
  onConfirm: () => void;
  preset: ExportPreset | null;
}

function PresetDeleteDialogContent({ onConfirm, preset }: PresetDeleteDialogContentProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
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
    onConfirm();
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("export.preset.delete.title")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("export.preset.delete.description", {
            name: preset ? getPresetDisplayName(preset, (id) => builtInNames[id]) : "",
          })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
        <AlertDialogAction onClick={deletePreset} variant="destructive">
          {t("export.preset.actions.delete")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export { PresetDeleteDialogContent };
export type { PresetDeleteDialogContentProps };
