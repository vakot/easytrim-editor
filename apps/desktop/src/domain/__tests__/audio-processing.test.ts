import { describe, expect, it } from "vitest";

import {
  areAudioFiltersValid,
  AUDIO_FILTER_PRESETS,
  type AudioFilter,
  audioTrackLoudnessInputsKey,
  clampTrackVolume,
  createAudioFilter,
  insertAudioFilter,
  matchingAudioFilterPreset,
  moveAudioFilter,
  normalizeAudioTrackDefaults,
  parseAudioTrackProcessing,
  removeAudioFilter,
  replaceAudioFilter,
  sameAudioFilters,
  sameLoudnessInputs,
  serializeAudioTrackSettings,
  waveformShapeFilters,
} from "../audio-processing";

const highPass = (id: string, cutoffHz = 80): AudioFilter => ({ cutoffHz, id, type: "highPass" });
const gain = (id: string, gainDb: number): AudioFilter => ({ gainDb, id, type: "gain" });
const normalization = (id: string, targetLufs = -16): AudioFilter => ({
  id,
  loudnessRangeLu: 11,
  maxTruePeakDb: -1.5,
  targetLufs,
  type: "loudnessNormalization",
});

const limiter = (id: string, ceilingDb = -1): AudioFilter => ({
  attackMs: 5,
  ceilingDb,
  id,
  releaseMs: 50,
  type: "limiter",
});

const trim = { endMicros: 4_000_000, startMicros: 1_000_000 };

describe("audio track metadata", () => {
  it("serializes output metadata under metadata and normalizes its language code", () => {
    expect(
      serializeAudioTrackSettings({
        enabled: true,
        metadata: { isDefault: true, language: "ru", title: "Commentary" },
        processing: { filters: [gain("g", -2)], volume: 0.5 },
        streamIndex: 4,
      }),
    ).toEqual({
      enabled: true,
      metadata: { isDefault: true, language: "rus", title: "Commentary" },
      processing: { filters: [gain("g", -2)], volume: 0.5 },
      streamIndex: 4,
    });
  });

  it("keeps the default flag under metadata while normalizing disabled tracks", () => {
    const processing = { filters: [], volume: 1 };
    expect(
      normalizeAudioTrackDefaults([
        { enabled: false, metadata: { isDefault: true }, processing, streamIndex: 2 },
        { enabled: true, metadata: { isDefault: false }, processing, streamIndex: 4 },
      ]).map((track) => track.metadata.isDefault),
    ).toEqual([false, true]);
  });
});

describe("ordered filter chain editing", () => {
  it("inserts after the selected instance and keeps repeated types as separate instances", () => {
    const filters = insertAudioFilter([gain("a", 3), highPass("hp")], gain("b", -6), "a");
    expect(filters.map(({ id }) => id)).toEqual(["a", "b", "hp"]);
    expect(insertAudioFilter(filters, limiter("lim")).map(({ id }) => id)).toEqual([
      "a",
      "b",
      "hp",
      "lim",
    ]);
  });

  it("moves, replaces, and removes instances by stable identity", () => {
    const filters = [gain("a", 3), highPass("hp"), limiter("lim")];
    const moved = moveAudioFilter(filters, "lim", 0);
    expect(moved.map(({ id }) => id)).toEqual(["lim", "a", "hp"]);
    expect(moveAudioFilter(moved, "lim", 99).map(({ id }) => id)).toEqual(["a", "hp", "lim"]);
    expect(replaceAudioFilter(moved, gain("a", -12))[1]).toEqual(gain("a", -12));
    expect(removeAudioFilter(moved, "hp").map(({ id }) => id)).toEqual(["lim", "a"]);
  });

  it("creates new instances with default explicit parameters", () => {
    expect(createAudioFilter("noiseReduction", "nr")).toEqual({
      id: "nr",
      noiseFloorDb: -35,
      reductionDb: 12,
      type: "noiseReduction",
    });
  });

  it("validates identifiers and every parameter range", () => {
    expect(areAudioFiltersValid([gain("a", 0), gain("b", 24)])).toBe(true);
    expect(areAudioFiltersValid([gain("a", 0), gain("a", 1)])).toBe(false);
    expect(areAudioFiltersValid([gain("bad id", 0)])).toBe(false);
    expect(areAudioFiltersValid([gain("a", 25)])).toBe(false);
    expect(areAudioFiltersValid([highPass("hp", 5)])).toBe(false);
    expect(
      areAudioFiltersValid([{ ...limiter("lim"), releaseMs: Number.NaN } as AudioFilter]),
    ).toBe(false);
  });

  it("compares chains independently of object key order", () => {
    const reordered = { type: "gain", gainDb: 3, id: "a" } as AudioFilter;
    expect(sameAudioFilters([gain("a", 3)], [reordered])).toBe(true);
    expect(sameAudioFilters([gain("a", 3), highPass("hp")], [highPass("hp"), gain("a", 3)])).toBe(
      false,
    );
  });
});

describe("presets", () => {
  it("match only explicit parameters and never become part of the filter", () => {
    const preset = AUDIO_FILTER_PRESETS.noiseReduction.find(({ id }) => id === "strong")!;
    const filter = { ...createAudioFilter("noiseReduction", "nr"), ...preset.parameters };
    expect(filter).not.toHaveProperty("preset");
    expect(matchingAudioFilterPreset(filter)).toBe("strong");
    expect(matchingAudioFilterPreset({ ...filter, reductionDb: 21 })).toBeUndefined();
  });
});

describe("loudness measurement identity", () => {
  it("is null without a normalization instance", () => {
    expect(audioTrackLoudnessInputsKey("source", 1, trim, [gain("a", 3)])).toBeNull();
  });

  it("changes with upstream filters, order, and range but not downstream processing", () => {
    const base = [highPass("hp"), normalization("norm")];
    const key = audioTrackLoudnessInputsKey("source", 1, trim, base);
    expect(
      audioTrackLoudnessInputsKey("source", 1, trim, [...base, gain("post", 6), limiter("lim")]),
    ).toBe(key);
    expect(
      audioTrackLoudnessInputsKey("source", 1, trim, [highPass("hp"), normalization("norm", -23)]),
    ).toBe(key);
    expect(
      audioTrackLoudnessInputsKey("source", 1, trim, [highPass("hp", 100), normalization("norm")]),
    ).not.toBe(key);
    expect(
      audioTrackLoudnessInputsKey("source", 1, trim, [normalization("norm"), highPass("hp")]),
    ).not.toBe(key);
    expect(
      audioTrackLoudnessInputsKey("source", 1, { ...trim, endMicros: 5_000_000 }, base),
    ).not.toBe(key);
  });

  it("includes earlier normalization targets when a later instance depends on them", () => {
    const chain = [normalization("first", -20), gain("g", 3), normalization("second")];
    expect(
      sameLoudnessInputs(chain, [
        normalization("first", -14),
        gain("g", 3),
        normalization("second"),
      ]),
    ).toBe(false);
    expect(sameLoudnessInputs(chain, [...chain, limiter("lim")])).toBe(true);
  });
});

describe("waveform shape", () => {
  it("uses only the leading shaping filters", () => {
    expect(
      waveformShapeFilters([highPass("hp"), gain("g", 6), highPass("late", 200)]).map(
        ({ id }) => id,
      ),
    ).toEqual(["hp"]);
    expect(waveformShapeFilters([gain("g", 6), highPass("hp")])).toEqual([]);
  });
});

describe("track volume", () => {
  it("parses only the current model and bounds Track Volume to 0-500%", () => {
    expect(parseAudioTrackProcessing({ filters: [gain("g", 3)], volume: 3.5 })).toEqual({
      filters: [gain("g", 3)],
      volume: 3.5,
    });
    expect(parseAudioTrackProcessing({ filters: [], volume: 5.5 })).toBeUndefined();
    expect(parseAudioTrackProcessing({ gainDb: 0 })).toBeUndefined();
    expect(clampTrackVolume(7)).toBe(5);
    expect(clampTrackVolume(-1)).toBe(0);
  });
});
