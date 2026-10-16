import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import type { TFunction } from "i18next";
import { ArrowDown, ArrowUp, CircleAlert, GripVertical, Plus, Trash2 } from "lucide-react";
import type { ComponentProps } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { LibraryNavigation, LibraryNavigationItem } from "@/components/library";
import {
  areAudioFiltersValid,
  AUDIO_FILTER_TYPES,
  type AudioFilter,
  MAX_AUDIO_FILTERS,
} from "@/domain/audio-processing";

import { useAudioFiltersDraft } from "../contexts/audio-filters-draft-context";
import { audioFilterDescriptor } from "../lib/audio-filter-fields";

/** Names each instance by its type, numbering repeated types in chain order. */
function audioFilterNames(filters: readonly AudioFilter[], t: TFunction): string[] {
  const seen = new Map<AudioFilter["type"], number>();
  return filters.map((filter) => {
    const name = audioFilterDescriptor(filter.type).label(t);
    const total = filters.filter((candidate) => candidate.type === filter.type).length;
    const number = (seen.get(filter.type) ?? 0) + 1;
    seen.set(filter.type, number);
    return total > 1 ? t("audio.filters.instanceName", { name, number }) : name;
  });
}

/**
 * The ordered chain as vertical tabs: list order is execution order. Instances reorder by
 * dragging their handle or with the toolbar, which also adds and removes instances.
 */
function AudioFilterList() {
  const { t } = useTranslation();
  const { dispatch, draft } = useAudioFiltersDraft();
  const names = audioFilterNames(draft.filters, t);
  const selectedIndex = draft.filters.findIndex((filter) => filter.id === draft.selectedId);
  const selectedId = draft.selectedId;

  return (
    <div className="flex min-h-0 w-64 shrink-0 flex-col" data-slot="audio-filter-list">
      {draft.filters.length === 0 ? (
        <p className="flex-1 p-4 text-sm text-muted-foreground">{t("audio.filters.empty")}</p>
      ) : (
        <DragDropProvider
          onDragEnd={(event) => {
            const { source } = event.operation;
            if (event.canceled || !isSortable(source) || source.initialIndex === source.index) {
              return;
            }
            dispatch({ id: String(source.id), toIndex: source.index, type: "moved" });
          }}
        >
          <LibraryNavigation aria-label={t("audio.filters.listLabel")} className="w-full flex-1">
            {draft.filters.map((filter, index) => (
              <AudioFilterListItem
                filter={filter}
                index={index}
                key={filter.id}
                name={names[index]!}
              />
            ))}
          </LibraryNavigation>
        </DragDropProvider>
      )}

      <div
        aria-label={t("audio.filters.actions.label")}
        className="flex items-center gap-1 border-t p-2"
        role="toolbar"
      >
        <AudioFilterListAction
          disabled={selectedId === null || selectedIndex <= 0}
          label={t("audio.filters.actions.moveUp")}
          onClick={() => {
            if (selectedId) dispatch({ id: selectedId, toIndex: selectedIndex - 1, type: "moved" });
          }}
        >
          <ArrowUp />
        </AudioFilterListAction>
        <AudioFilterListAction
          disabled={selectedId === null || selectedIndex >= draft.filters.length - 1}
          label={t("audio.filters.actions.moveDown")}
          onClick={() => {
            if (selectedId) dispatch({ id: selectedId, toIndex: selectedIndex + 1, type: "moved" });
          }}
        >
          <ArrowDown />
        </AudioFilterListAction>
        <AudioFilterAddMenu disabled={draft.filters.length >= MAX_AUDIO_FILTERS} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <AudioFilterListAction
              disabled={selectedId === null}
              label={t("audio.filters.actions.remove")}
              variant="destructive"
            >
              <Trash2 />
            </AudioFilterListAction>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("audio.filters.removeConfirmation.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("audio.filters.removeConfirmation.description", {
                  name: selectedIndex >= 0 ? names[selectedIndex] : "",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedId) dispatch({ id: selectedId, type: "removed" });
                }}
                variant="destructive"
              >
                {t("audio.filters.actions.remove")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function AudioFilterListItem({
  filter,
  index,
  name,
}: {
  filter: AudioFilter;
  index: number;
  name: string;
}) {
  const { t } = useTranslation();
  const { handleRef, isDragSource, ref } = useSortable({
    id: filter.id,
    index,
    transition: { idle: true },
  });

  const valid = areAudioFiltersValid([filter]);

  return (
    <div
      className="flex items-center gap-0.5 data-[dragging=true]:opacity-50"
      data-dragging={isDragSource}
      data-slot="audio-filter-list-item"
      ref={ref}
    >
      {/* Pointer reordering only; keyboard users reorder with the toolbar. */}
      <span
        aria-hidden="true"
        className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
        ref={handleRef}
      >
        <GripVertical className="size-4" />
      </span>
      <LibraryNavigationItem className="min-w-0 flex-1" value={filter.id}>
        <span className="min-w-0 truncate">{name}</span>
        {valid ? null : (
          <CircleAlert
            aria-label={t("audio.filters.invalidFilter")}
            className="ml-auto text-destructive"
            role="img"
          />
        )}
      </LibraryNavigationItem>
    </div>
  );
}

function AudioFilterAddMenu({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const { dispatch } = useAudioFiltersDraft();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("audio.filters.actions.add")}
              disabled={disabled}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Plus />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("audio.filters.actions.add")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start">
        {AUDIO_FILTER_TYPES.map((filterType) => (
          <DropdownMenuItem
            key={filterType}
            onSelect={() => dispatch({ filterType, id: crypto.randomUUID(), type: "added" })}
          >
            {audioFilterDescriptor(filterType).label(t)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AudioFilterListAction({
  label,
  ...props
}: ComponentProps<typeof Button> & {
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={label} size="icon-sm" type="button" variant="ghost" {...props} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export { AudioFilterList };
