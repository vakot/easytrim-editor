import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import type { TFunction } from "i18next";
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  GripVertical,
  LockKeyhole,
  Plus,
  PowerOff,
  Trash2,
} from "lucide-react";
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
import { Ping } from "@/components/ping";
import {
  areAudioFiltersValid,
  AUDIO_FILTER_TYPES,
  type AudioFilter,
  type AudioSyncOffset,
  isAudioSyncOffsetWithinRange,
  MAX_AUDIO_FILTERS,
} from "@/domain/audio-processing";
import { cn } from "@/lib/class-names.utils";

import { useAudioFiltersDraft } from "../contexts/audio-filters-draft-context";
import { audioFilterLabel } from "../lib/audio-filter-label";
import { AUDIO_SYNC_OFFSET_ID, isAudioFilterChanged } from "../lib/audio-filters-draft";

/** Names each instance by its type, numbering repeated types in chain order. */
function audioFilterNames(filters: readonly AudioFilter[], t: TFunction): string[] {
  const seen = new Map<AudioFilter["type"], number>();
  return filters.map((filter) => {
    const name = audioFilterLabel(filter.type, t);
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
  const visibleNames = draft.syncOffset ? [t("audio.syncOffset.label"), ...names] : names;
  const selectedFilterIndex = draft.filters.findIndex((filter) => filter.id === draft.selectedId);
  const selectedIndex =
    draft.selectedId === AUDIO_SYNC_OFFSET_ID
      ? 0
      : selectedFilterIndex + (draft.syncOffset ? 1 : 0);

  const visibleLength = draft.filters.length + (draft.syncOffset ? 1 : 0);
  const selectedId = draft.selectedId;

  return (
    <div className="flex min-h-0 w-64 shrink-0 flex-col" data-slot="audio-filter-list">
      {visibleLength === 0 ? (
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
            {draft.syncOffset ? <AudioSyncOffsetListItem offset={draft.syncOffset} /> : null}
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
          disabled={
            selectedId === null || selectedId === AUDIO_SYNC_OFFSET_ID || selectedFilterIndex <= 0
          }
          label={t("audio.filters.actions.moveUp")}
          onClick={() => {
            if (selectedId && selectedId !== AUDIO_SYNC_OFFSET_ID) {
              dispatch({ id: selectedId, toIndex: selectedFilterIndex - 1, type: "moved" });
            }
          }}
        >
          <ArrowUp />
        </AudioFilterListAction>
        <AudioFilterListAction
          disabled={
            selectedId === null ||
            selectedId === AUDIO_SYNC_OFFSET_ID ||
            selectedIndex >= visibleLength - 1
          }
          label={t("audio.filters.actions.moveDown")}
          onClick={() => {
            if (selectedId && selectedId !== AUDIO_SYNC_OFFSET_ID) {
              dispatch({ id: selectedId, toIndex: selectedFilterIndex + 1, type: "moved" });
            }
          }}
        >
          <ArrowDown />
        </AudioFilterListAction>
        <AudioFilterAddMenu
          disabled={draft.filters.length >= MAX_AUDIO_FILTERS && !!draft.syncOffset}
        />
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
                  name: selectedIndex >= 0 ? visibleNames[selectedIndex] : "",
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

  const { draft } = useAudioFiltersDraft();
  const valid = areAudioFiltersValid([filter]);
  const changed = isAudioFilterChanged(draft, filter);

  return (
    <div
      className="relative flex items-center gap-0.5 data-[dragging=true]:opacity-50"
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

      {changed ? <Ping /> : null}

      <LibraryNavigationItem className="min-w-0 flex-1" value={filter.id}>
        <span className={cn("min-w-0 truncate", !filter.enabled && "text-muted-foreground")}>
          {name}
        </span>
        {filter.enabled ? null : (
          <PowerOff
            aria-label={t("audio.filters.disabledFilter")}
            className="ml-auto text-muted-foreground"
            role="img"
          />
        )}
        {valid ? null : (
          <CircleAlert
            aria-label={t("audio.filters.invalidFilter")}
            className={cn("text-destructive", filter.enabled && "ml-auto")}
            role="img"
          />
        )}
      </LibraryNavigationItem>
    </div>
  );
}

function AudioSyncOffsetListItem({ offset }: { offset: AudioSyncOffset }) {
  const { t } = useTranslation();
  const { draft, syncOffsetRange } = useAudioFiltersDraft();
  const changed =
    draft.initialSyncOffset?.enabled !== offset.enabled ||
    draft.initialSyncOffset?.offsetMicros !== offset.offsetMicros;

  const valid = isAudioSyncOffsetWithinRange(offset.offsetMicros, syncOffsetRange);

  return (
    <div className="relative flex items-center gap-0.5" data-slot="audio-filter-list-item">
      <span
        aria-label={t("audio.filters.lockedOrder")}
        className="flex h-8 w-5 shrink-0 items-center justify-center text-muted-foreground"
        role="img"
      >
        <LockKeyhole aria-hidden="true" className="size-4" />
      </span>
      {changed ? <Ping /> : null}
      <LibraryNavigationItem className="min-w-0 flex-1" value={AUDIO_SYNC_OFFSET_ID}>
        <span className={cn("min-w-0 truncate", !offset.enabled && "text-muted-foreground")}>
          {t("audio.syncOffset.label")}
        </span>
        {offset.enabled ? null : (
          <PowerOff
            aria-label={t("audio.filters.disabledFilter")}
            className="ml-auto text-muted-foreground"
            role="img"
          />
        )}
        {valid ? null : (
          <CircleAlert
            aria-label={t("audio.filters.invalidFilter")}
            className={cn("text-destructive", offset.enabled && "ml-auto")}
            role="img"
          />
        )}
      </LibraryNavigationItem>
    </div>
  );
}

function AudioFilterAddMenu({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const { dispatch, draft } = useAudioFiltersDraft();

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
        <DropdownMenuItem
          disabled={draft.syncOffset !== null}
          onSelect={() => dispatch({ type: "syncOffsetAdded" })}
        >
          {t("audio.syncOffset.label")}
        </DropdownMenuItem>
        {AUDIO_FILTER_TYPES.map((filterType) => (
          <DropdownMenuItem
            disabled={draft.filters.length >= MAX_AUDIO_FILTERS}
            key={filterType}
            onSelect={() => dispatch({ filterType, id: crypto.randomUUID(), type: "added" })}
          >
            {audioFilterLabel(filterType, t)}
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
