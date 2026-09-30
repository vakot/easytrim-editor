import { describe, expect, it } from "vitest";

import { DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION } from "@/domain/audio-processing";

import {
  createNormalizeLoudnessFormState,
  getDraftLoudnessNormalization,
  isNormalizeLoudnessEffectValid,
  isNormalizeLoudnessFormDirty,
  isNormalizeLoudnessFormValid,
  normalizeLoudnessFormReducer,
} from "../lib/normalize-loudness-form";

describe("normalize loudness form", () => {
  it("starts disabled with a default configuration without enabling the effect", () => {
    const form = createNormalizeLoudnessFormState({ gainDb: 0 });

    expect(form.enabled).toBe(false);
    expect(form.normalization).toBe("webVideo");
    expect(form.targetLufsInput).toBe("-14");
    expect(form.maxTruePeakDbInput).toBe("-1");
    expect(getDraftLoudnessNormalization(form, undefined, undefined)).toBeUndefined();
  });

  it("preserves the selected configuration when toggled", () => {
    const initial = createNormalizeLoudnessFormState({ gainDb: 0 });
    const custom = normalizeLoudnessFormReducer(initial, {
      type: "presetChanged",
      value: "custom",
    });

    const disabled = normalizeLoudnessFormReducer(custom, {
      type: "enabledChanged",
      value: true,
    });

    const enabled = normalizeLoudnessFormReducer(disabled, {
      type: "enabledChanged",
      value: false,
    });

    expect(enabled.normalization).toEqual(DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION);
    expect(enabled.targetLufsInput).toBe(String(DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION.targetLufs));
    expect(enabled.maxTruePeakDbInput).toBe(
      String(DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION.maxTruePeakDb),
    );
  });

  it("updates target values when switching presets", () => {
    const form = normalizeLoudnessFormReducer(createNormalizeLoudnessFormState({ gainDb: 0 }), {
      type: "presetChanged",
      value: "broadcast",
    });

    expect(form.normalization).toBe("broadcast");
    expect(form.targetLufsInput).toBe("-23");
    expect(form.maxTruePeakDbInput).toBe("-2");
  });

  it("creates default custom values and retains edited custom values", () => {
    const initial = createNormalizeLoudnessFormState({ gainDb: 0 });
    const custom = normalizeLoudnessFormReducer(initial, {
      type: "presetChanged",
      value: "custom",
    });

    const edited = normalizeLoudnessFormReducer(custom, { type: "targetChanged", value: "-19" });
    const restored = normalizeLoudnessFormReducer(edited, {
      type: "presetChanged",
      value: "custom",
    });

    expect(custom.normalization).toEqual(DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION);
    expect(restored.normalization).toEqual({
      mode: "custom",
      targetLufs: -19,
      maxTruePeakDb: DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION.maxTruePeakDb,
    });
  });

  it("selects Custom when either custom value changes", () => {
    const initial = normalizeLoudnessFormReducer(createNormalizeLoudnessFormState({ gainDb: 0 }), {
      type: "presetChanged",
      value: "streaming",
    });

    const targetEdited = normalizeLoudnessFormReducer(initial, {
      type: "targetChanged",
      value: "-18.5",
    });

    const peakEdited = normalizeLoudnessFormReducer(initial, {
      type: "peakChanged",
      value: "-2.3",
    });

    expect(targetEdited.normalization).toMatchObject({ mode: "custom", targetLufs: -18.5 });
    expect(peakEdited.normalization).toMatchObject({ mode: "custom", maxTruePeakDb: -2.3 });
  });

  it("keeps intermediate invalid input out of the processing draft", () => {
    const customNormalization = {
      mode: "custom",
      targetLufs: -16,
      maxTruePeakDb: -1.5,
    } as const;

    const form = normalizeLoudnessFormReducer(
      createNormalizeLoudnessFormState({
        gainDb: 0,
        loudnessNormalization: customNormalization,
      }),
      { type: "targetChanged", value: "" },
    );

    expect(form.targetLufsInput).toBe("");
    expect(isNormalizeLoudnessFormValid(form)).toBe(false);
    expect(getDraftLoudnessNormalization(form, customNormalization, customNormalization)).toEqual(
      customNormalization,
    );
  });

  it("calculates dirty state from enabled state and normalization choice", () => {
    const initial = createNormalizeLoudnessFormState({ gainDb: 0 });
    const enabled = normalizeLoudnessFormReducer(initial, {
      type: "enabledChanged",
      value: true,
    });

    const configured = normalizeLoudnessFormReducer(initial, {
      type: "presetChanged",
      value: "streaming",
    });

    expect(isNormalizeLoudnessFormDirty(initial)).toBe(false);
    expect(isNormalizeLoudnessFormDirty(enabled)).toBe(true);
    expect(isNormalizeLoudnessFormDirty(configured)).toBe(true);
  });

  it("rejects invalid enabled Custom settings but ignores dormant invalid values", () => {
    const invalidForm = normalizeLoudnessFormReducer(
      normalizeLoudnessFormReducer(createNormalizeLoudnessFormState({ gainDb: 0 }), {
        type: "presetChanged",
        value: "custom",
      }),
      { type: "targetChanged", value: "-40" },
    );

    const enabled = normalizeLoudnessFormReducer(invalidForm, {
      type: "enabledChanged",
      value: true,
    });

    expect(isNormalizeLoudnessFormValid(enabled)).toBe(false);
    expect(isNormalizeLoudnessEffectValid(enabled)).toBe(false);
    expect(isNormalizeLoudnessEffectValid(invalidForm)).toBe(true);
  });
});
