import { ChevronDownIcon, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  DropdownMenuIcon,
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
  exportPresetDeleted,
  exportPresetSelected,
  exportPresetUpdated,
  selectExportArguments,
  selectExportPresetList,
  selectSelectedExportPreset,
} from "@/app/store/slices/export-presets-slice";
type PresetDialogMode = "create" | "edit";

function PresetManager() {
  const { t } = useTranslation();
  const builtInLabels: Record<BuiltInPresetId, { description: string; name: string }> = {
    "hevc-nvenc-p1": {
      name: t("export.preset.builtIn.p1.name"),
      description: t("export.preset.builtIn.p1.description"),
    },
    "hevc-nvenc-p2": {
      name: t("export.preset.builtIn.p2.name"),
      description: t("export.preset.builtIn.p2.description"),
    },
    "hevc-nvenc-p3": {
      name: t("export.preset.builtIn.p3.name"),
      description: t("export.preset.builtIn.p3.description"),
    },
    "hevc-nvenc-p4": {
      name: t("export.preset.builtIn.p4.name"),
      description: t("export.preset.builtIn.p4.description"),
    },
    "hevc-nvenc-p5": {
      name: t("export.preset.builtIn.p5.name"),
      description: t("export.preset.builtIn.p5.description"),
    },
    "hevc-nvenc-p6": {
      name: t("export.preset.builtIn.p6.name"),
      description: t("export.preset.builtIn.p6.description"),
    },
    "hevc-nvenc-p7": {
      name: t("export.preset.builtIn.p7.name"),
      description: t("export.preset.builtIn.p7.description"),
    },
  };

  const displayPresetName = (preset: ExportPreset) =>
    getPresetDisplayName(preset, (id) => builtInLabels[id].name);

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
  const editingPreset = presets.find((preset) => preset.id === editingPresetId);
  const namePlaceholder =
    dialogMode === "edit" && editingPreset?.kind === "builtIn"
      ? builtInLabels[editingPreset.id].name
      : t("export.preset.namePlaceholder");

  const presetErrorMessages: Record<PresetNameError, string> = {
    duplicate: t("export.preset.validation.duplicate"),
    required: t("export.preset.validation.required"),
    tooLong: t("export.preset.validation.tooLong"),
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
    setDraftName(preset.kind === "builtIn" ? (preset.customName ?? "") : preset.name);
    setDraftArguments(preset.argumentsText);
    setPresetError(null);
    setDialogMode("edit");
  }

  function savePreset() {
    const existingNames = presets
      .filter((preset) => preset.id !== editingPresetId)
      .map(displayPresetName);

    let error: PresetNameError | null = null;

    if (dialogMode === "create") {
      error = presetNameError({ candidateName: draftName, existingNames });
    } else if (editingPreset?.kind === "builtIn") {
      const normalizedName = draftName.trim();
      const systemName = builtInLabels[editingPreset.id].name;
      if (normalizedName && normalizedName !== systemName) {
        error = presetNameError({ candidateName: normalizedName, existingNames });
      }
    } else if (editingPreset?.kind === "custom") {
      error = presetNameError({ candidateName: draftName, existingNames });
    }

    if (error) {
      setPresetError(error);
      return;
    }

    if (dialogMode === "edit" && editingPreset) {
      dispatch(exportPresetSelected(editingPreset.id));
      if (editingPreset.kind === "builtIn") {
        const normalizedName = draftName.trim();
        const systemName = builtInLabels[editingPreset.id].name;
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
      if (dialogMode !== "create") return;
      dispatch(exportArgumentsChanged(draftArguments));
      dispatch(exportPresetCreated({ name: draftName }));
    }
    setDialogMode(null);
  }

  return (
    <section className="grid gap-1.5">
      <Label>{t("export.preset.label")}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={selectTriggerVariants({
            variant: "primary",
            className: "w-full min-w-0 font-normal",
          })}
          data-size="default"
        >
          <span className="truncate">
            {selectedPreset
              ? displayPresetName(selectedPreset)
              : t("export.preset.selectPlaceholder")}
          </span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56" sideOffset={6}>
          <DropdownMenuGroup>
            {presets.map((preset) => (
              <div className="flex items-center gap-1" key={preset.id}>
                <DropdownMenuItem
                  className="h-auto min-w-0 flex-1 items-start"
                  onSelect={() => dispatch(exportPresetSelected(preset.id))}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{displayPresetName(preset)}</span>
                    {preset.kind === "builtIn" || preset.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {preset.kind === "builtIn"
                          ? builtInLabels[preset.id].description
                          : preset.description}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    aria-label={t("export.preset.actionsLabel")}
                    className="size-8 min-w-0 shrink-0 justify-center p-0 [&>span:last-child]:hidden"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-32" sideOffset={4}>
                    <DropdownMenuGroup>
                      <DropdownMenuItem inset onSelect={() => openEditDialog(preset)}>
                        <DropdownMenuIcon>
                          <Pencil className="size-3.5" />
                        </DropdownMenuIcon>
                        {t("export.preset.actions.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        inset
                        onSelect={() => setPresetToDelete(preset)}
                        variant="destructive"
                      >
                        <DropdownMenuIcon>
                          <Trash2 className="size-3.5" />
                        </DropdownMenuIcon>
                        {t("export.preset.actions.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </div>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem inset onSelect={openCreateDialog}>
              <DropdownMenuIcon>
                <Plus className="size-3.5" />
              </DropdownMenuIcon>
              {t("export.preset.actions.add")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={(open) => !open && setDialogMode(null)} open={dialogMode !== null}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("export.preset.create.title")}</DialogTitle>
            <DialogDescription>{t("export.preset.create.description")}</DialogDescription>
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

      <AlertDialog
        onOpenChange={(open) => !open && setPresetToDelete(null)}
        open={presetToDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("export.preset.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("export.preset.delete.description", {
                name: presetToDelete ? displayPresetName(presetToDelete) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (presetToDelete) {
                  dispatch(exportPresetSelected(presetToDelete.id));
                  dispatch(exportPresetDeleted());
                }
                setPresetToDelete(null);
              }}
              variant="destructive"
            >
              {t("export.preset.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export { PresetManager };
