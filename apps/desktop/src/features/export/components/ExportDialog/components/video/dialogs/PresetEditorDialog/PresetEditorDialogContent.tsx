import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DialogScope } from "@/components/ui/dialog";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  type BuiltInPresetId,
  type ExportPreset,
  getPresetDisplayName,
  type PresetNameError,
  presetNameError,
} from "@/app/store/lib/export-presets";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  exportArgumentsChanged,
  exportPresetCreated,
  exportPresetSelected,
  exportPresetUpdated,
  selectExportArguments,
  selectExportPresetList,
} from "@/app/store/slices/export-presets-slice";

import { usePresetEditorDialog } from "./PresetEditorDialogContext";

function PresetEditorDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();
  const { request } = usePresetEditorDialog();
  const mode = request?.mode ?? "create";
  const preset = request?.mode === "edit" ? request.preset : null;
  const builtInLabels: Record<BuiltInPresetId, { name: string }> = {
    "hevc-nvenc-p1": { name: t("export.preset.builtIn.p1.name") },
    "hevc-nvenc-p2": { name: t("export.preset.builtIn.p2.name") },
    "hevc-nvenc-p3": { name: t("export.preset.builtIn.p3.name") },
    "hevc-nvenc-p4": { name: t("export.preset.builtIn.p4.name") },
    "hevc-nvenc-p5": { name: t("export.preset.builtIn.p5.name") },
    "hevc-nvenc-p6": { name: t("export.preset.builtIn.p6.name") },
    "hevc-nvenc-p7": { name: t("export.preset.builtIn.p7.name") },
  };

  const dispatch = useAppDispatch();
  const presets = useAppSelector(selectExportPresetList);
  const argumentsText = useAppSelector(selectExportArguments);
  const [draftName, setDraftName] = useState(() =>
    preset ? (preset.kind === "builtIn" ? (preset.customName ?? "") : preset.name) : "",
  );

  const [draftArguments, setDraftArguments] = useState(
    () => preset?.argumentsText ?? argumentsText,
  );

  const [presetError, setPresetError] = useState<PresetNameError | null>(null);

  const displayPresetName = (item: ExportPreset) =>
    getPresetDisplayName(item, (id) => builtInLabels[id].name);

  const existingNames = presets.filter((item) => item.id !== preset?.id).map(displayPresetName);
  const namePlaceholder =
    preset?.kind === "builtIn" ? builtInLabels[preset.id].name : t("export.preset.namePlaceholder");

  const presetErrorMessages: Record<PresetNameError, string> = {
    duplicate: t("export.preset.validation.duplicate"),
    required: t("export.preset.validation.required"),
    tooLong: t("export.preset.validation.tooLong"),
  };

  function savePreset(event: React.MouseEvent<HTMLButtonElement>) {
    let error: PresetNameError | null = null;

    if (mode === "create") {
      error = presetNameError({ candidateName: draftName, existingNames });
    } else if (preset?.kind === "builtIn") {
      const normalizedName = draftName.trim();
      const systemName = builtInLabels[preset.id].name;
      if (normalizedName && normalizedName !== systemName) {
        error = presetNameError({ candidateName: normalizedName, existingNames });
      }
    } else if (preset?.kind === "custom") {
      error = presetNameError({ candidateName: draftName, existingNames });
    }

    if (error) {
      event.preventDefault();
      setPresetError(error);
      return;
    }

    if (mode === "edit" && preset) {
      dispatch(exportPresetSelected(preset.id));
      if (preset.kind === "builtIn") {
        const normalizedName = draftName.trim();
        const systemName = builtInLabels[preset.id].name;
        dispatch(
          exportPresetUpdated({
            presetKind: "builtIn",
            customName: normalizedName && normalizedName !== systemName ? normalizedName : null,
            argumentsText: draftArguments,
          }),
        );
      } else {
        dispatch(
          exportPresetUpdated({
            presetKind: "custom",
            name: draftName.trim(),
            argumentsText: draftArguments,
          }),
        );
      }
    } else {
      dispatch(exportArgumentsChanged(draftArguments));
      dispatch(exportPresetCreated({ name: draftName }));
    }
  }

  if (mode === "edit" && !preset) return null;

  return (
    <>
      <DialogHeader>
        <DialogTitle __scopeDialog={__scopeDialog}>{t("export.preset.create.title")}</DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          {t("export.preset.create.description")}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="preset-name">{t("export.preset.nameLabel")}</Label>
          <Input
            id="preset-name"
            onChange={(event) => setDraftName(event.target.value)}
            placeholder={namePlaceholder}
            value={draftName}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="preset-arguments">{t("export.optimized.dialog.arguments")}</Label>
          <Textarea
            className="min-h-28 resize-y font-mono text-xs"
            id="preset-arguments"
            onChange={(event) => setDraftArguments(event.target.value)}
            value={draftArguments}
          />
        </div>

        {presetError ? (
          <Alert variant="destructive">
            <AlertDescription>{presetErrorMessages[presetError]}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <DialogFooter __scopeDialog={__scopeDialog}>
        <DialogClose __scopeDialog={__scopeDialog} asChild>
          <Button type="button" variant="outline">
            {t("common.actions.cancel")}
          </Button>
        </DialogClose>
        <DialogClose __scopeDialog={__scopeDialog} asChild>
          <Button onClick={savePreset} type="button">
            {t("common.actions.save")}
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

export { PresetEditorDialogContent };
