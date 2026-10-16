import {
  areAudioFiltersValid,
  type AudioFilter,
  type AudioFilterType,
  createAudioFilter,
  insertAudioFilter,
  MAX_AUDIO_FILTERS,
  moveAudioFilter,
  removeAudioFilter,
  replaceAudioFilter,
  sameAudioFilters,
} from "@/domain/audio-processing";

/**
 * The dialog-local copy of a track's chain. Every edit changes only the draft; the committed chain
 * changes once, atomically, when a valid draft is applied.
 */
interface AudioFiltersDraft {
  filters: AudioFilter[];
  initialFilters: AudioFilter[];
  selectedId: string | null;
}

type AudioFiltersDraftAction =
  | { filterType: AudioFilterType; id: string; type: "added" }
  | { filter: AudioFilter; type: "updated" }
  | { id: string; toIndex: number; type: "moved" }
  | { id: string; type: "removed" }
  | { id: string; type: "selected" };

function createAudioFiltersDraft(filters: readonly AudioFilter[]): AudioFiltersDraft {
  const copy = filters.map((filter) => ({ ...filter }));
  return {
    filters: copy,
    initialFilters: copy.map((filter) => ({ ...filter })),
    selectedId: copy[0]?.id ?? null,
  };
}

function audioFiltersDraftReducer(
  draft: AudioFiltersDraft,
  action: AudioFiltersDraftAction,
): AudioFiltersDraft {
  switch (action.type) {
    case "added": {
      if (draft.filters.length >= MAX_AUDIO_FILTERS) return draft;
      // A new instance goes right after the selected one, so it can be placed while building.
      const filter = createAudioFilter(action.filterType, action.id);
      return {
        ...draft,
        filters: insertAudioFilter(draft.filters, filter, draft.selectedId ?? undefined),
        selectedId: filter.id,
      };
    }
    case "updated":
      return { ...draft, filters: replaceAudioFilter(draft.filters, action.filter) };
    case "moved":
      return { ...draft, filters: moveAudioFilter(draft.filters, action.id, action.toIndex) };
    case "removed": {
      const index = draft.filters.findIndex((filter) => filter.id === action.id);
      if (index === -1) return draft;
      const filters = removeAudioFilter(draft.filters, action.id);
      const selectedId =
        draft.selectedId === action.id
          ? (filters[Math.min(index, filters.length - 1)]?.id ?? null)
          : draft.selectedId;

      return { ...draft, filters, selectedId };
    }
    case "selected":
      return draft.filters.some((filter) => filter.id === action.id)
        ? { ...draft, selectedId: action.id }
        : draft;
  }
}

/** Whether an instance is new or differs from how the dialog opened; reordering alone is not a change. */
function isAudioFilterChanged(draft: AudioFiltersDraft, filter: AudioFilter): boolean {
  const initial = draft.initialFilters.find(({ id }) => id === filter.id);
  return !initial || !sameAudioFilters([initial], [filter]);
}

function isAudioFiltersDraftDirty(draft: AudioFiltersDraft): boolean {
  return !sameAudioFilters(draft.initialFilters, draft.filters);
}

function isAudioFiltersDraftValid(draft: AudioFiltersDraft): boolean {
  return areAudioFiltersValid(draft.filters);
}

export type { AudioFiltersDraft, AudioFiltersDraftAction };
export {
  audioFiltersDraftReducer,
  createAudioFiltersDraft,
  isAudioFilterChanged,
  isAudioFiltersDraftDirty,
  isAudioFiltersDraftValid,
};
