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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        <DropdownMenu>
          <DropdownMenuTrigger
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
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56" sideOffset={6}>
            <DropdownMenuGroup>
              {presets.map((preset) => (
                <div className="flex items-center gap-1" key={preset.id}>
                  <DropdownMenuItem
                    className="min-w-0 flex-1"
                    onSelect={() => dispatch(exportPresetSelected(preset.id))}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{preset.name}</span>
                      {preset.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {preset.description}
                        </span>
                      ) : null}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      aria-label={t("export.accessibility.presetActions")}
                      className="size-8 shrink-0 justify-center p-0"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-32">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onSelect={() => openEditDialog(preset)}>
                          <Pencil className="size-3.5" />
                          {t("common.actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setPresetToDelete(preset)}
                          variant="destructive"
                        >
                          <Trash2 className="size-3.5" />
                          {t("common.actions.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </div>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={openCreateDialog}>
                <Plus className="size-3.5" />
                {t("export.actions.addPreset")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
