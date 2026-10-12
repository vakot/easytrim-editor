import { ChevronDownIcon, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
import { Label } from "@/components/ui/label";
import { selectTriggerVariants } from "@/components/ui/select";

import {
  type BuiltInPresetId,
  type ExportPreset,
  getPresetDisplayName,
} from "@/app/store/lib/export-presets";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  exportPresetSelected,
  selectExportPresetList,
  selectSelectedExportPreset,
} from "@/app/store/slices/export-presets-slice";
import { preloadOnIntent } from "@/lib/lazy-component";

import { PresetDeleteDialog } from "../dialogs/PresetDeleteDialog";
import { PresetEditorDialog } from "../dialogs/PresetEditorDialog";

type PresetEditorRequest = { mode: "create" } | { mode: "edit"; preset: ExportPreset };

const preloadPresetEditorDialog = preloadOnIntent(() => PresetEditorDialog.preload());
const preloadPresetDeleteDialog = preloadOnIntent(() => PresetDeleteDialog.preload());

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

  const dispatch = useAppDispatch();
  const presets = useAppSelector(selectExportPresetList);
  const selectedPreset = useAppSelector(selectSelectedExportPreset);
  const [editorRequest, setEditorRequest] = useState<PresetEditorRequest | null>(null);
  const [presetToDelete, setPresetToDelete] = useState<ExportPreset | null>(null);
  const displayPresetName = (preset: ExportPreset) =>
    getPresetDisplayName(preset, (id) => builtInLabels[id].name);

  function openEditor(request: PresetEditorRequest) {
    void PresetEditorDialog.preload().then(
      () => setEditorRequest(request),
      () => setEditorRequest(request),
    );
  }

  function openDeleteDialog(preset: ExportPreset) {
    void PresetDeleteDialog.preload().then(
      () => setPresetToDelete(preset),
      () => setPresetToDelete(preset),
    );
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
                      <DropdownMenuItem
                        inset
                        onFocus={preloadPresetEditorDialog}
                        onPointerMove={preloadPresetEditorDialog}
                        onSelect={() => openEditor({ mode: "edit", preset })}
                      >
                        <DropdownMenuIcon>
                          <Pencil className="size-3.5" />
                        </DropdownMenuIcon>
                        {t("export.preset.actions.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        inset
                        onFocus={preloadPresetDeleteDialog}
                        onPointerMove={preloadPresetDeleteDialog}
                        onSelect={() => openDeleteDialog(preset)}
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
            <DropdownMenuItem
              inset
              onFocus={preloadPresetEditorDialog}
              onPointerMove={preloadPresetEditorDialog}
              onSelect={() => openEditor({ mode: "create" })}
            >
              <DropdownMenuIcon>
                <Plus className="size-3.5" />
              </DropdownMenuIcon>
              {t("export.preset.actions.add")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <PresetEditorDialog
        mode={editorRequest?.mode ?? "create"}
        onOpenChange={(open) => !open && setEditorRequest(null)}
        open={editorRequest !== null}
        preset={editorRequest?.mode === "edit" ? editorRequest.preset : null}
      />
      <PresetDeleteDialog
        onOpenChange={(open) => !open && setPresetToDelete(null)}
        open={presetToDelete !== null}
        preset={presetToDelete}
      />
    </section>
  );
}

export { PresetManager };
