import { ChevronDownIcon, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
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
import { Separator } from "@/components/ui/separator";
import { selectTriggerVariants } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  presetNameError,
  type ExportPreset,
} from "../export-presets";
import {
  exportArgumentsChanged,
  exportPresetCreated,
  exportPresetDeleted,
  exportPresetSelected,
  exportPresetUpdated,
  selectExportPresets,
  selectSelectedExportPreset,
} from "@/app/store/slices/export-presets-slice";

type PresetDialogMode = "create" | "edit";

export function PresetManager() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectExportPresets);
  const selectedPreset = useAppSelector(selectSelectedExportPreset);
  const [dialogMode, setDialogMode] = useState<PresetDialogMode | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftArguments, setDraftArguments] = useState("");
  const [presetError, setPresetError] = useState<string | null>(null);
  const [presetToDelete, setPresetToDelete] = useState<ExportPreset | null>(null);

  function openCreateDialog() {
    setEditingPresetId(null);
    setDraftName("");
    setDraftArguments(state.argumentsText);
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
    const error = presetNameError(state.presets, draftName, editingPresetId ?? undefined);
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
        <Label>{t("export.presets.label", "Preset")}</Label>
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger
            data-size="default"
            className={selectTriggerVariants({
              variant: "primary",
              className: "w-full font-normal",
            })}
          >
            <span className="truncate">
              {selectedPreset?.name ?? t("export.presets.select", "Select a preset")}
            </span>
            <ChevronDownIcon className="pointer-events-none size-4 shrink-0" />
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              align="start"
              sideOffset={6}
              className="z-50 min-w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {state.presets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1">
                  <DropdownMenuPrimitive.Item
                    className="min-w-0 flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                    onSelect={() => dispatch(exportPresetSelected(preset.id))}
                  >
                    <span className="block truncate">{preset.name}</span>
                    {preset.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {preset.description}
                      </span>
                    ) : null}
                  </DropdownMenuPrimitive.Item>
                  <DropdownMenuPrimitive.Sub>
                    <DropdownMenuPrimitive.SubTrigger
                      aria-label={t("export.presets.actions", "Preset actions")}
                      className="flex size-8 shrink-0 items-center justify-center rounded-sm outline-none hover:bg-accent focus:bg-accent"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuPrimitive.SubTrigger>
                    <DropdownMenuPrimitive.Portal>
                      <DropdownMenuPrimitive.SubContent
                        sideOffset={4}
                        className="z-50 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                      >
                        <DropdownMenuPrimitive.Item
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                          onSelect={() => openEditDialog(preset)}
                        >
                          <Pencil className="size-3.5" />
                          {t("export.presets.edit", "Edit")}
                        </DropdownMenuPrimitive.Item>
                        <DropdownMenuPrimitive.Item
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none focus:bg-accent"
                          onSelect={() => setPresetToDelete(preset)}
                        >
                          <Trash2 className="size-3.5" />
                          {t("export.presets.delete", "Delete")}
                        </DropdownMenuPrimitive.Item>
                      </DropdownMenuPrimitive.SubContent>
                    </DropdownMenuPrimitive.Portal>
                  </DropdownMenuPrimitive.Sub>
                </div>
              ))}
              <Separator className="my-1" />
              <DropdownMenuPrimitive.Item
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
                onSelect={openCreateDialog}
              >
                <Plus className="size-3.5" />
                {t("export.presets.new", "Add new preset")}
              </DropdownMenuPrimitive.Item>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("export.presets.newTitle", "New preset")}</DialogTitle>
            <DialogDescription>
              {t("export.presets.dialogDescription", "Save a reusable FFmpeg configuration.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="preset-name">{t("export.presets.name", "Name")}</Label>
              <Input
                id="preset-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="preset-arguments">{t("export.dialog.arguments")}</Label>
              <Textarea
                id="preset-arguments"
                className="min-h-28 resize-y font-mono text-xs"
                value={draftArguments}
                onChange={(event) => setDraftArguments(event.target.value)}
              />
            </div>
            {presetError ? <p className="text-xs text-destructive">{presetError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={savePreset}>{t("common.save", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={presetToDelete !== null}
        onOpenChange={(open) => !open && setPresetToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("export.presets.deleteTitle", "Delete preset?")}</DialogTitle>
            <DialogDescription>
              {t("export.presets.deleteDescription", {
                name: presetToDelete?.name ?? "",
                defaultValue: `Delete “${presetToDelete?.name ?? ""}”? This cannot be undone.`,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetToDelete(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (presetToDelete) {
                  dispatch(exportPresetSelected(presetToDelete.id));
                  dispatch(exportPresetDeleted());
                }
                setPresetToDelete(null);
              }}
            >
              {t("export.presets.delete", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
