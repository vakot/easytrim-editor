import { ChevronDownIcon, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import { selectTriggerVariants } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  type ExportPreset,
  type PresetNameError,
  presetNameError,
} from "@/app/store/lib/export-presets";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  exportArgumentsChanged,
  exportPresetCreated,
  exportPresetDeleted,
  exportPresetSelected,
  exportPresetUpdated,
  selectExportArguments,
  selectExportPresetList,
  selectSelectedExportPreset,
} from "@/app/store/slices/export-presets-slice";

type PresetDialogMode = "create" | "edit";

export function PresetManager() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const presets = useAppSelector(selectExportPresetList);
  const argumentsText = useAppSelector(selectExportArguments);
  const selectedPreset = useAppSelector(selectSelectedExportPreset);
  const [dialogMode, setDialogMode] = useState<PresetDialogMode | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftArguments, setDraftArguments] = useState("");
  const [presetError, setPresetError] = useState<PresetNameError | null>(null);
  const [presetToDelete, setPresetToDelete] = useState<ExportPreset | null>(null);
  const presetErrorMessages: Record<PresetNameError, string> = {
    duplicate: t("export.messages.presetNameDuplicate"),
    required: t("export.messages.presetNameRequired"),
    tooLong: t("export.messages.presetNameTooLong"),
  };

  function openCreateDialog() {
    setEditingPresetId(null);
    setDraftName("");
    setDraftArguments(argumentsText);
    setPresetError(null);
    setDialogMode("create");
  }

  function openEditDialog(preset: ExportPreset) {
    setEditingPresetId(preset.id);
    setDraftName(preset.name);
    setDraftArguments(preset.argumentsText);
    setPresetError(null);
    setDialogMode("edit");
  }

  function savePreset() {
    const error = presetNameError(presets, draftName, editingPresetId ?? undefined);
    if (error) {
      setPresetError(error);
      return;
    }

    if (dialogMode === "edit" && editingPresetId) {
      dispatch(exportPresetSelected(editingPresetId));
      dispatch(exportArgumentsChanged(draftArguments));
      dispatch(exportPresetUpdated({ name: draftName }));
    } else {
      dispatch(exportArgumentsChanged(draftArguments));
      dispatch(exportPresetCreated({ name: draftName }));
    }
    setDialogMode(null);
  }

  return (
    <section className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>{t("export.labels.preset")}</Label>
        <Menu>
          <MenuTrigger
            className={selectTriggerVariants({
              variant: "primary",
              className: "w-full font-normal",
            })}
            data-size="default"
          >
            <span className="truncate">
              {selectedPreset?.name ?? t("export.options.selectPreset")}
            </span>
            <ChevronDownIcon className="pointer-events-none size-4 shrink-0" />
          </MenuTrigger>
          <MenuContent
            align="start"
            className="z-50 min-w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            sideOffset={6}
          >
            {presets.map((preset) => (
              <div className="flex items-center gap-1" key={preset.id}>
                <MenuItem
                  className="min-w-0 flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                  onSelect={() => dispatch(exportPresetSelected(preset.id))}
                >
                  <span className="block truncate">{preset.name}</span>
                  {preset.description ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {preset.description}
                    </span>
                  ) : null}
                </MenuItem>
                <MenuSub>
                  <MenuSubTrigger
                    aria-label={t("export.accessibility.presetActions")}
                    className="flex size-8 shrink-0 items-center justify-center rounded-sm outline-none hover:bg-accent focus:bg-accent"
                  >
                    <MoreHorizontal className="size-4" />
                  </MenuSubTrigger>
                  <MenuSubContent
                    className="z-50 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                    sideOffset={4}
                  >
                    <MenuItem
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                      onSelect={() => openEditDialog(preset)}
                    >
                      <Pencil className="size-3.5" />
                      {t("common.actions.edit")}
                    </MenuItem>
                    <MenuItem
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none focus:bg-accent"
                      onSelect={() => setPresetToDelete(preset)}
                    >
                      <Trash2 className="size-3.5" />
                      {t("common.actions.delete")}
                    </MenuItem>
                  </MenuSubContent>
                </MenuSub>
              </div>
            ))}
            <MenuSeparator className="my-1" />
            <MenuItem
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
              onSelect={openCreateDialog}
            >
              <Plus className="size-3.5" />
              {t("export.actions.addPreset")}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <Dialog onOpenChange={(open) => !open && setDialogMode(null)} open={dialogMode !== null}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("export.dialogs.preset.createTitle")}</DialogTitle>
            <DialogDescription>{t("export.dialogs.preset.createDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="preset-name">{t("export.dialogs.preset.name")}</Label>
              <Input
                id="preset-name"
                onChange={(event) => setDraftName(event.target.value)}
                value={draftName}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="preset-arguments">{t("export.dialogs.optimized.arguments")}</Label>
              <Textarea
                className="min-h-28 resize-y font-mono text-xs"
                id="preset-arguments"
                onChange={(event) => setDraftArguments(event.target.value)}
                value={draftArguments}
              />
            </div>
            {presetError ? (
              <p className="text-xs text-destructive">{presetErrorMessages[presetError]}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setDialogMode(null)} variant="outline">
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={savePreset}>{t("common.actions.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setPresetToDelete(null)}
        open={presetToDelete !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("export.dialogs.preset.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("export.dialogs.preset.deleteDescription", {
                name: presetToDelete?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPresetToDelete(null)} variant="outline">
              {t("common.actions.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (presetToDelete) {
                  dispatch(exportPresetSelected(presetToDelete.id));
                  dispatch(exportPresetDeleted());
                }
                setPresetToDelete(null);
              }}
              variant="destructive"
            >
              {t("common.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
