import { describe, expect, it } from "vitest";

import {
  exportArgumentsChanged,
  exportPresetCreated,
  exportPresetDeleted,
  exportPresetSelected,
  exportPresetUpdated,
  exportPresetsReducer,
} from "@/app/store/slices/export-presets-slice";
import {
  initialExportPresetState,
  loadExportPresetState,
  persistExportPresetState,
  presetNameError,
} from "../export-presets";

describe("export presets", () => {
  it("creates, selects, renames, updates, and deletes runtime presets", () => {
    const edited = exportPresetsReducer(
      initialExportPresetState,
      exportArgumentsChanged("-c:v libx264 -crf 20"),
    );
    const created = exportPresetsReducer(edited, exportPresetCreated({ name: "CPU fallback" }));
    expect(created.presets.find((preset) => preset.id === created.selectedPresetId)).toMatchObject({
      name: "CPU fallback",
      argumentsText: "-c:v libx264 -crf 20",
    });

    const selected = exportPresetsReducer(
      created,
      exportPresetSelected("runtime-preset-1"),
    );
    const updated = exportPresetsReducer(
      exportPresetsReducer(selected, exportArgumentsChanged("-c:v libx264 -crf 18")),
      exportPresetUpdated({ name: "High quality CPU" }),
    );
    expect(updated.presets.find((preset) => preset.id === updated.selectedPresetId)).toMatchObject({
      name: "High quality CPU",
      argumentsText: "-c:v libx264 -crf 18",
    });

    const deleted = exportPresetsReducer(updated, exportPresetDeleted());
    expect(deleted.presets).toHaveLength(7);
    expect(deleted.presets[0]?.name).toBe("P1 · Fastest");
  });

  it("rejects blank, long, and duplicate names without changing state", () => {
    expect(presetNameError(initialExportPresetState.presets, " ")).toBe(
      "A preset name is required.",
    );
    expect(presetNameError(initialExportPresetState.presets, "x".repeat(65))).toBe(
      "Preset names must be 64 characters or fewer.",
    );
    expect(presetNameError(initialExportPresetState.presets, "P3 · Fast")).toBe(
      "Preset names must be unique.",
    );
    expect(
      exportPresetsReducer(initialExportPresetState, exportPresetCreated({ name: "P3 · Fast" })),
    ).toBe(initialExportPresetState);
  });

  it("provides the full NVENC preset range", () => {
    expect(initialExportPresetState.presets).toHaveLength(7);
    expect(initialExportPresetState.presets[0]?.argumentsText).toContain("-preset p1");
    expect(initialExportPresetState.presets[4]?.argumentsText).toContain("-preset p5");
    expect(initialExportPresetState.presets[6]?.argumentsText).toContain("-preset p7");
  });

  it("round-trips presets through versioned storage", () => {
    const saved = exportPresetsReducer(
      exportPresetsReducer(initialExportPresetState, exportPresetCreated({ name: "Portable" })),
      exportPresetSelected("runtime-preset-1"),
    );
    persistExportPresetState(saved);
    expect(loadExportPresetState()).toEqual(saved);
  });
});
