import { describe, expect, it } from "vitest";

import type { AudioFilter } from "@/domain/audio-processing";

import {
  audioFiltersDraftReducer,
  createAudioFiltersDraft,
  isAudioFiltersDraftDirty,
  isAudioFiltersDraftValid,
} from "../audio-filters-draft";

const gain = (id: string, gainDb = 0): AudioFilter => ({ enabled: true, gainDb, id, type: "gain" });
const ids = (filters: readonly AudioFilter[]) => filters.map(({ id }) => id);

describe("audio filters draft", () => {
  it("starts from a copy of the committed chain with the first instance selected", () => {
    const committed = [gain("a"), gain("b")];
    const draft = createAudioFiltersDraft(committed);

    expect(draft.selectedId).toBe("a");
    expect(draft.filters).toEqual(committed);
    expect(draft.filters[0]).not.toBe(committed[0]);
    expect(isAudioFiltersDraftDirty(draft)).toBe(false);
  });

  it("inserts new instances after the selection and selects them", () => {
    let draft = createAudioFiltersDraft([gain("a"), gain("c")]);
    draft = audioFiltersDraftReducer(draft, { filterType: "gain", id: "b", type: "added" });
    expect(ids(draft.filters)).toEqual(["a", "b", "c"]);
    expect(draft.selectedId).toBe("b");

    draft = audioFiltersDraftReducer(draft, {
      filterType: "loudnessNormalization",
      id: "n",
      type: "added",
    });
    expect(ids(draft.filters)).toEqual(["a", "b", "n", "c"]);
    expect(draft.filters[2]).toMatchObject({
      enabled: true,
      targetLufs: -16,
      type: "loudnessNormalization",
    });
    expect(isAudioFiltersDraftDirty(draft)).toBe(true);
  });

  it("keeps the selection when moving and selects a neighbor after removal", () => {
    let draft = createAudioFiltersDraft([gain("a"), gain("b"), gain("c")]);
    draft = audioFiltersDraftReducer(draft, { id: "b", type: "selected" });
    draft = audioFiltersDraftReducer(draft, { id: "b", toIndex: 0, type: "moved" });
    expect(ids(draft.filters)).toEqual(["b", "a", "c"]);
    expect(draft.selectedId).toBe("b");

    draft = audioFiltersDraftReducer(draft, { id: "c", type: "selected" });
    draft = audioFiltersDraftReducer(draft, { id: "c", type: "removed" });
    expect(draft.selectedId).toBe("a");
    draft = audioFiltersDraftReducer(draft, { id: "a", type: "removed" });
    draft = audioFiltersDraftReducer(draft, { id: "b", type: "removed" });
    expect(draft).toMatchObject({ filters: [], selectedId: null });
  });

  it("tracks validity of edited parameters without touching the committed chain", () => {
    const committed = [gain("a", 3)];
    let draft = createAudioFiltersDraft(committed);
    draft = audioFiltersDraftReducer(draft, { filter: gain("a", Number.NaN), type: "updated" });

    expect(isAudioFiltersDraftValid(draft)).toBe(false);
    expect(committed).toEqual([gain("a", 3)]);

    draft = audioFiltersDraftReducer(draft, { filter: gain("a", 3), type: "updated" });
    expect(isAudioFiltersDraftValid(draft)).toBe(true);
    expect(isAudioFiltersDraftDirty(draft)).toBe(false);
  });

  it("stops adding instances at the chain limit", () => {
    const full = createAudioFiltersDraft(
      Array.from({ length: 32 }, (_, index) => gain(`g${index}`)),
    );

    expect(audioFiltersDraftReducer(full, { filterType: "gain", id: "extra", type: "added" })).toBe(
      full,
    );
  });
});
