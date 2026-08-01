import { describe, expect, it } from "vitest";

import {
  exportPresetReducer,
  initialExportPresetState,
  loadExportPresetState,
  persistExportPresetState,
  presetNameError,
  selectedExportPreset,
} from "../export-presets";

describe("export presets", () => {
  it("creates, selects, renames, updates, and deletes runtime presets", () => {
    const edited = exportPresetReducer(initialExportPresetState, {
      type: "arguments-changed",
      argumentsText: "-c:v libx264 -crf 20",
    });
    const creating = exportPresetReducer(edited, { type: "preset-new-started" });
    const created = exportPresetReducer(creating, {
      type: "preset-created",
      name: "CPU fallback",
    });

    expect(selectedExportPreset(created)).toMatchObject({
      name: "CPU fallback",
      argumentsText: "-c:v libx264 -crf 20",
    });

    const updated = exportPresetReducer(
      exportPresetReducer(created, {
        type: "arguments-changed",
        argumentsText: "-c:v libx264 -crf 18",
      }),
      { type: "preset-updated", name: "High quality CPU" },
    );
    expect(selectedExportPreset(updated)).toMatchObject({
      name: "High quality CPU",
      argumentsText: "-c:v libx264 -crf 18",
    });

    const deleted = exportPresetReducer(updated, { type: "preset-deleted" });
    expect(deleted.presets).toHaveLength(1);
    expect(selectedExportPreset(deleted)?.name).toBe("Balanced HEVC (NVENC)");
  });

  it("rejects blank, long, and duplicate names without changing state", () => {
    expect(presetNameError(initialExportPresetState.presets, " ")).toBe(
      "A preset name is required.",
    );
    expect(presetNameError(initialExportPresetState.presets, "x".repeat(65))).toBe(
      "Preset names must be 64 characters or fewer.",
    );
    expect(presetNameError(initialExportPresetState.presets, "balanced hevc (nvenc)")).toBe(
      "Preset names must be unique.",
    );
    expect(
      exportPresetReducer(initialExportPresetState, {
        type: "preset-created",
        name: "Balanced HEVC (NVENC)",
      }),
    ).toBe(initialExportPresetState);
  });

  it("round-trips presets through versioned storage", () => {
    const state = exportPresetReducer(initialExportPresetState, {
      type: "preset-new-started",
    });
    const saved = exportPresetReducer(state, { type: "preset-created", name: "Portable" });

    persistExportPresetState(saved);

    expect(loadExportPresetState()).toEqual(saved);
  });
});
