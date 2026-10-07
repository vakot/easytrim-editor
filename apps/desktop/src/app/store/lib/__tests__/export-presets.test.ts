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
  getPresetDisplayName,
  initialExportPresetState,
  isBuiltInPresetId,
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
      kind: "custom",
      name: "CPU fallback",
      argumentsText: "-c:v libx264 -crf 20",
    });

    const selected = exportPresetsReducer(created, exportPresetSelected("runtime-preset-1"));
    const updated = exportPresetsReducer(
      exportPresetsReducer(selected, exportArgumentsChanged("-c:v libx264 -crf 18")),
      exportPresetUpdated({
        presetKind: "custom",
        name: "High quality CPU",
        argumentsText: "-c:v libx264 -crf 18",
      }),
    );

    expect(updated.presets.find((preset) => preset.id === updated.selectedPresetId)).toMatchObject({
      name: "High quality CPU",
      argumentsText: "-c:v libx264 -crf 18",
    });

    const deleted = exportPresetsReducer(updated, exportPresetDeleted());
    expect(deleted.presets).toHaveLength(7);
    expect(deleted.presets[0]).toMatchObject({ id: "hevc-nvenc-p1", kind: "builtIn" });
  });

  it("validates names against the supplied visible names", () => {
    expect(presetNameError({ candidateName: " ", existingNames: [] })).toBe("required");
    expect(presetNameError({ candidateName: "x".repeat(65), existingNames: [] })).toBe("tooLong");
    expect(
      presetNameError({ candidateName: "P3 · Быстрый", existingNames: ["P3 · Быстрый"] }),
    ).toBe("duplicate");
    expect(
      presetNameError({ candidateName: "P3 · Fast", existingNames: ["P3 · Быстрый"] }),
    ).toBeNull();
  });

  it("identifies built-in presets only by stable ID and keeps localized names out of state", () => {
    const preset = initialExportPresetState.presets[2]!;

    expect(preset).toEqual({
      id: "hevc-nvenc-p3",
      kind: "builtIn",
      argumentsText: expect.stringContaining("-preset p3"),
    });
    expect(isBuiltInPresetId(preset.id)).toBe(true);
    expect(isBuiltInPresetId("runtime-preset-1")).toBe(false);
    expect(getPresetDisplayName(preset, () => "P3 · Быстрый")).toBe("P3 · Быстрый");
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

  it("repairs built-in arguments saved with legacy NVENC option names", () => {
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

  it("ignores incompatible v1 preset storage and loads the new defaults", () => {
    localStorage.setItem(
      "easytrim.export-presets.v1",
      JSON.stringify({
        ...initialExportPresetState,
        presets: initialExportPresetState.presets.map((preset) => ({
          ...preset,
          name: "legacy display name",
        })),
      }),
    );

    const loaded = loadExportPresetState();

    expect(loaded).toEqual(initialExportPresetState);
    expect(loaded.presets.every((preset) => preset.kind === "builtIn")).toBe(true);
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
