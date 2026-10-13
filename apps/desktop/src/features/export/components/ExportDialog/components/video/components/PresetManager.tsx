import { ChevronDownIcon, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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

import { PresetDeleteDialog, PresetDeleteDialogTrigger } from "../dialogs/PresetDeleteDialog";
import { PresetEditorDialog, PresetEditorDialogTrigger } from "../dialogs/PresetEditorDialog";

function PresetManager() {
  return (
    <PresetEditorDialog>
      <PresetDeleteDialog>
        <section className="grid gap-1.5">
          <PresetSelector />
        </section>
      </PresetDeleteDialog>
    </PresetEditorDialog>
  );
}

function PresetSelector() {
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

  const presets = useAppSelector(selectExportPresetList);
  const selectedPreset = useAppSelector(selectSelectedExportPreset);
  const displayPresetName = (preset: ExportPreset) =>
    getPresetDisplayName(preset, (id) => builtInLabels[id].name);

  return (
    <>
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
              <PresetOption
                description={
                  preset.kind === "builtIn"
                    ? builtInLabels[preset.id].description
                    : preset.description
                }
                key={preset.id}
                name={displayPresetName(preset)}
                preset={preset}
                showDescription={preset.kind === "builtIn" || Boolean(preset.description)}
              />
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <PresetEditorDialogTrigger asChild request={{ mode: "create" }}>
              <DropdownMenuItem inset>
                <DropdownMenuIcon>
                  <Plus className="size-3.5" />
                </DropdownMenuIcon>
                {t("export.preset.actions.add")}
              </DropdownMenuItem>
            </PresetEditorDialogTrigger>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function PresetOption({
  description,
  name,
  preset,
  showDescription,
}: {
  description?: string;
  name: string;
  preset: ExportPreset;
  showDescription: boolean;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <div className="flex items-center gap-1">
      <DropdownMenuItem
        className="h-auto min-w-0 flex-1 items-start"
        onSelect={() => dispatch(exportPresetSelected(preset.id))}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{name}</span>
          {showDescription ? (
            <span className="block truncate text-xs text-muted-foreground">{description}</span>
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
            <PresetEditorDialogTrigger asChild request={{ mode: "edit", preset }}>
              <DropdownMenuItem inset>
                <DropdownMenuIcon>
                  <Pencil className="size-3.5" />
                </DropdownMenuIcon>
                {t("export.preset.actions.edit")}
              </DropdownMenuItem>
            </PresetEditorDialogTrigger>
            <PresetDeleteDialogTrigger asChild preset={preset}>
              <DropdownMenuItem inset variant="destructive">
                <DropdownMenuIcon>
                  <Trash2 className="size-3.5" />
                </DropdownMenuIcon>
                {t("export.preset.actions.delete")}
              </DropdownMenuItem>
            </PresetDeleteDialogTrigger>
          </DropdownMenuGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </div>
  );
}

export { PresetManager };
