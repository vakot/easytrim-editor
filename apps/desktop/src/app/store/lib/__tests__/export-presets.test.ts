import { describe, expect, it } from "vitest";

import {
  exportArgumentsChanged,
  exportPresetCreated,
  exportPresetDeleted,
  exportPresetSelected,
  exportPresetsReducer,
  exportPresetUpdated,
} from "@/app/store/slices/export-presets-slice";
import { STORAGE_KEYS } from "@/lib/storage.consts";

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

    const selected = exportPresetsReducer(created, exportPresetSelected("runtime-preset-1"));
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
    expect(presetNameError(initialExportPresetState.presets, " ")).toBe("required");
    expect(presetNameError(initialExportPresetState.presets, "x".repeat(65))).toBe("tooLong");
    expect(presetNameError(initialExportPresetState.presets, "P3 · Fast")).toBe("duplicate");
    expect(
      exportPresetsReducer(initialExportPresetState, exportPresetCreated({ name: "P3 · Fast" })),
    ).toBe(initialExportPresetState);
  });

  it("provides the full NVENC preset range", () => {
    expect(initialExportPresetState.presets).toHaveLength(7);
    expect(initialExportPresetState.presets[0]?.argumentsText).toContain("-preset p1");
    expect(initialExportPresetState.presets[4]?.argumentsText).toContain("-preset p5");
    expect(initialExportPresetState.presets[6]?.argumentsText).toContain("-preset p7");
    expect(initialExportPresetState.presets[2]?.argumentsText).toContain("-spatial-aq 1");
    expect(initialExportPresetState.presets[2]?.argumentsText).toContain("-temporal-aq 1");
    expect(initialExportPresetState.presets[2]?.argumentsText).not.toContain("_aq");
  });

  it("repairs unchanged built-in presets saved with legacy NVENC option names", () => {
    const legacy = structuredClone(initialExportPresetState);
    legacy.presets[2]!.argumentsText = legacy.presets[2]!.argumentsText.replace(
      "-spatial-aq",
      "-spatial_aq",
    ).replace("-temporal-aq", "-temporal_aq");
    legacy.argumentsText = legacy.presets[2]!.argumentsText;
    localStorage.setItem(STORAGE_KEYS.exportPresets, JSON.stringify(legacy));

    const loaded = loadExportPresetState();

    expect(loaded.presets[2]?.argumentsText).toContain("-spatial-aq 1");
    expect(loaded.presets[2]?.argumentsText).toContain("-temporal-aq 1");
  });

  it("migrates legacy built-in defaults without creating name overrides", () => {
    const legacy = structuredClone(initialExportPresetState);
    const legacyNames = [
      "P1 · Fastest",
      "P2 · Very fast",
      "P3 · Fast",
      "P4 · Quality",
      "P5 · Smaller",
      "P6 · Very small",
      "P7 · Smallest",
    ];
    legacy.presets.forEach((preset, index) => {
      preset.name = legacyNames[index]!;
    });
    localStorage.setItem(STORAGE_KEYS.exportPresets, JSON.stringify(legacy));

    const loaded = loadExportPresetState();

    expect(loaded.presets).toHaveLength(7);
    expect(loaded.presets.every((preset) => preset.nameOverride === undefined)).toBe(true);
  });

  it("preserves renamed built-in presets as name overrides during migration", () => {
    const legacy = structuredClone(initialExportPresetState);
    legacy.presets[2]!.name = "My fast preset";
    localStorage.setItem(STORAGE_KEYS.exportPresets, JSON.stringify(legacy));

    const loaded = loadExportPresetState();

    expect(loaded.presets[2]).toMatchObject({
      id: "hevc-nvenc-p3",
      name: "P3 · Fast",
      nameOverride: "My fast preset",
    });
  });

  it("leaves custom presets unchanged during built-in name migration", () => {
    const legacy = structuredClone(initialExportPresetState);
    legacy.presets.push({
      id: "runtime-preset-1",
      name: "My custom preset",
      argumentsText: "-c:v libx264 -crf 20",
    });
    legacy.nextPresetSequence = 1;
    localStorage.setItem(STORAGE_KEYS.exportPresets, JSON.stringify(legacy));

    const loaded = loadExportPresetState();

    expect(loaded.presets.at(-1)).toEqual({
      id: "runtime-preset-1",
      name: "My custom preset",
      argumentsText: "-c:v libx264 -crf 20",
    });
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
