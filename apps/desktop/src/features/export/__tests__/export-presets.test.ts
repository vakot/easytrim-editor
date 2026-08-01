import { describe, expect, it } from "vitest";

import {
  exportPresetReducer,
  initialExportPresetState,
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
    expect(deleted.presets).toHaveLength(5);
    expect(selectedExportPreset(deleted)?.name).toBe("P1 · Fastest");
  });

  it("rejects blank, long, and duplicate names without changing state", () => {
    expect(presetNameError(initialExportPresetState.presets, " ")).toBe(
      "A preset name is required.",
    );
    expect(presetNameError(initialExportPresetState.presets, "x".repeat(65))).toBe(
      "Preset names must be 64 characters or fewer.",
    );
    expect(presetNameError(initialExportPresetState.presets, "p3 · fast")).toBe(
      "Preset names must be unique.",
    );
    expect(
      exportPresetReducer(initialExportPresetState, {
        type: "preset-created",
        name: "P3 · Fast",
      }),
    ).toBe(initialExportPresetState);
  });

  it("provides five NVENC defaults from fastest to smallest", () => {
    expect(initialExportPresetState.presets).toHaveLength(5);
    expect(initialExportPresetState.presets.map((preset) => preset.id)).toEqual([
      "hevc-nvenc-p1",
      "hevc-nvenc-p2",
      "hevc-nvenc-p3",
      "hevc-nvenc-p4",
      "hevc-nvenc-p5",
    ]);
    expect(initialExportPresetState.presets[0]?.argumentsText).toContain("-preset p1");
    expect(initialExportPresetState.presets[4]?.argumentsText).toContain("-preset p5");
  });
});
