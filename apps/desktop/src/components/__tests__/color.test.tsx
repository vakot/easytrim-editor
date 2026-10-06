import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, type Mock, vi } from "vitest";

import {
  ColorPicker,
  ColorPickerHue,
  ColorPickerInput,
  ColorPickerPreset,
  ColorPickerSaturationValue,
  ColorPickerSpectrum,
} from "@/components/color";
import type { HexColor } from "@/lib/color.types";
import { hsvToHex } from "@/lib/color.utils";

function toRgb(hex: string) {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${channels.join(", ")})`;
}

function mockBounds(
  element: HTMLElement,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(left, top, width, height),
  });

  const releasePointerCapture = vi.fn();
  Object.assign(element, {
    hasPointerCapture: () => true,
    releasePointerCapture,
    setPointerCapture: vi.fn(),
  });

  return { releasePointerCapture };
}

function getControls() {
  const spectrum = screen.getByRole("button", {
    name: "Saturation and brightness",
  });

  const hue = screen.getByRole("slider", { name: "Hue" });
  mockBounds(spectrum, 10, 20, 100, 100);
  mockBounds(hue, 10, 150, 100, 16);

  return {
    hue,
    hueMarker: hue.querySelector<HTMLElement>('[data-slot="color-hue-marker"]')!,
    spectrum,
    spectrumMarker: spectrum.querySelector<HTMLElement>('[data-slot="color-spectrum-marker"]')!,
  };
}

function drag(
  element: HTMLElement,
  type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
  x: number,
  y: number,
  pointerId = 1,
) {
  const event = { button: 0, clientX: x, clientY: y, pointerId };

  if (type === "pointerDown") fireEvent.pointerDown(element, event);
  if (type === "pointerMove") fireEvent.pointerMove(element, event);
  if (type === "pointerUp") fireEvent.pointerUp(element, event);
  if (type === "pointerCancel") fireEvent.pointerCancel(element, event);
}

function renderPicker({
  defaultValue = "#4299e1",
  onChange = vi.fn<(color: HexColor) => void>(),
  onCommit = vi.fn<(color: HexColor) => void>(),
}: {
  defaultValue?: HexColor;
  onChange?: Mock<(color: HexColor) => void>;
  onCommit?: Mock<(color: HexColor) => void>;
} = {}) {
  const view = render(
    <ColorPicker defaultValue={defaultValue} onChange={onChange} onCommit={onCommit}>
      <ColorPickerSpectrum aria-label="Color picker">
        <ColorPickerSaturationValue aria-label="Saturation and brightness" />
        <ColorPickerHue aria-label="Hue" />
      </ColorPickerSpectrum>
      <ColorPickerInput aria-label="Color HEX" />
      <ColorPickerPreset value="#efbf04">
        <button type="button">Amber</button>
      </ColorPickerPreset>
    </ColorPicker>,
  );

  return { ...view, onChange, onCommit };
}

describe("ColorPicker", () => {
  it("commits a preset through the current picker session", async () => {
    const user = userEvent.setup();
    const { onChange, onCommit } = renderPicker();
    const { hueMarker, spectrumMarker } = getControls();
    const initialSpectrumColor = spectrumMarker.style.backgroundColor;
    const initialHuePosition = hueMarker.style.left;

    await user.click(screen.getByRole("button", { name: "Amber" }));

    expect(onChange).toHaveBeenCalledWith("#efbf04");
    expect(onCommit).toHaveBeenCalledWith("#efbf04");
    expect(screen.getByRole("textbox", { name: "Color HEX" })).toHaveValue("efbf04");
    expect(spectrumMarker.style.backgroundColor).not.toBe(initialSpectrumColor);
    expect(hueMarker.style.left).not.toBe(initialHuePosition);
  });

  it("keeps incomplete HEX drafts local and commits valid HEX immediately", () => {
    const { onChange, onCommit } = renderPicker();
    const input = screen.getByRole("textbox", { name: "Color HEX" });

    for (const draft of ["", "a", "abc", "abc12"]) {
      fireEvent.change(input, { target: { value: draft } });
      expect(onChange).not.toHaveBeenCalled();
      expect(onCommit).not.toHaveBeenCalled();
    }

    fireEvent.change(input, { target: { value: "ABCDEF" } });

    expect(onChange).toHaveBeenCalledWith("#abcdef");
    expect(onCommit).toHaveBeenCalledWith("#abcdef");
  });

  it("emits every pointer change but commits only once on release", () => {
    const { onChange, onCommit } = renderPicker();
    const { spectrum } = getControls();

    drag(spectrum, "pointerDown", 60, 70);
    drag(spectrum, "pointerMove", 85, 45);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onCommit).not.toHaveBeenCalled();

    drag(spectrum, "pointerUp", 85, 45);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith(onChange.mock.calls[1]?.[0]);
  });

  it("keeps both hue endpoints stable after commit and can drag back from the right", () => {
    const { onCommit } = renderPicker();
    const { hue, hueMarker } = getControls();

    drag(hue, "pointerDown", 10, 158);
    drag(hue, "pointerUp", 10, 158);
    expect(hueMarker.style.left).toBe("0%");

    drag(hue, "pointerDown", 110, 158);
    drag(hue, "pointerUp", 110, 158);
    expect(hueMarker.style.left).toBe("100%");
    expect(hue).toHaveAttribute("aria-valuenow", "360");
    expect(onCommit).toHaveBeenLastCalledWith("#e14242");

    drag(hue, "pointerDown", 60, 158);
    expect(hueMarker.style.left).toBe("50%");
    drag(hue, "pointerUp", 60, 158);
    expect(hueMarker.style.left).toBe("50%");
  });

  it("preserves committed hue while saturation becomes grayscale and is restored", () => {
    const { onChange } = renderPicker();
    const { hue, hueMarker, spectrum, spectrumMarker } = getControls();

    drag(hue, "pointerDown", 97.5, 158);
    drag(hue, "pointerUp", 97.5, 158);
    expect(hueMarker.style.left).toBe("87.5%");

    drag(spectrum, "pointerDown", 10, 20, 2);
    drag(spectrum, "pointerUp", 10, 20, 2);
    expect(spectrumMarker.style.left).toBe("0%");
    expect(hueMarker.style.left).toBe("87.5%");

    drag(hue, "pointerDown", 10, 158, 3);
    drag(hue, "pointerCancel", 10, 158, 3);
    expect(hueMarker.style.left).toBe("87.5%");
    expect(onChange).toHaveBeenLastCalledWith("#ffffff");

    drag(spectrum, "pointerDown", 40, 20, 4);
    expect(spectrumMarker.style.backgroundColor).toBe(toRgb(hsvToHex(315, 30, 100)));
    expect(hueMarker.style.left).toBe("87.5%");
    drag(spectrum, "pointerUp", 40, 20, 4);
  });

  it("preserves hue and saturation through black and cancellation", () => {
    const { onChange } = renderPicker();
    const { hue, hueMarker, spectrum, spectrumMarker } = getControls();

    drag(hue, "pointerDown", 97.5, 158);
    drag(hue, "pointerUp", 97.5, 158);
    drag(spectrum, "pointerDown", 60, 120, 2);
    drag(spectrum, "pointerUp", 60, 120, 2);

    expect(spectrumMarker.style.left).toBe("50%");
    expect(spectrumMarker.style.top).toBe("100%");
    expect(hueMarker.style.left).toBe("87.5%");

    drag(hue, "pointerDown", 10, 158, 3);
    drag(hue, "pointerCancel", 10, 158, 3);
    expect(hueMarker.style.left).toBe("87.5%");
    expect(onChange).toHaveBeenLastCalledWith("#000000");

    drag(spectrum, "pointerDown", 60, 70, 4);
    expect(spectrumMarker.style.backgroundColor).toBe(toRgb(hsvToHex(315, 50, 50)));
    expect(spectrumMarker.style.left).toBe("50%");
    expect(hueMarker.style.left).toBe("87.5%");
    drag(spectrum, "pointerUp", 60, 70, 4);
  });

  it("keeps spectrum and hue controls independent through repeated interactions", () => {
    const { hue, hueMarker, spectrum, spectrumMarker } = getControlsForDefault("#123456");
    const startingHuePosition = hueMarker.style.left;

    drag(spectrum, "pointerDown", 41.25, 64.75);
    expect(hueMarker.style.left).toBe(startingHuePosition);
    const spectrumPosition = { left: spectrumMarker.style.left, top: spectrumMarker.style.top };
    drag(spectrum, "pointerMove", 98.875, 32.625);
    drag(spectrum, "pointerMove", 41.25, 64.75);
    expect(spectrumMarker.style.left).toBe(spectrumPosition.left);
    expect(spectrumMarker.style.top).toBe(spectrumPosition.top);
    expect(hueMarker.style.left).toBe(startingHuePosition);
    drag(spectrum, "pointerUp", 41.25, 64.75);
    expect(spectrumMarker.style.left).toBe(spectrumPosition.left);
    expect(spectrumMarker.style.top).toBe(spectrumPosition.top);

    const spectrumAfterCommit = { left: spectrumMarker.style.left, top: spectrumMarker.style.top };
    drag(hue, "pointerDown", 77.125, 158, 2);
    const huePosition = hueMarker.style.left;
    expect(spectrumMarker.style.left).toBe(spectrumAfterCommit.left);
    expect(spectrumMarker.style.top).toBe(spectrumAfterCommit.top);
    drag(hue, "pointerMove", 24.875, 158, 2);
    drag(hue, "pointerMove", 77.125, 158, 2);
    expect(hueMarker.style.left).toBe(huePosition);
    expect(spectrumMarker.style.left).toBe(spectrumAfterCommit.left);
    expect(spectrumMarker.style.top).toBe(spectrumAfterCommit.top);
    drag(hue, "pointerUp", 77.125, 158, 2);
  });

  it("clamps pointer coordinates outside each control", () => {
    const { hue, hueMarker, spectrum, spectrumMarker } = getControlsForDefault();

    drag(hue, "pointerDown", -40, 158);
    expect(hueMarker.style.left).toBe("0%");
    drag(hue, "pointerMove", 160, 158);
    expect(hueMarker.style.left).toBe("100%");
    drag(hue, "pointerUp", 160, 158);

    drag(spectrum, "pointerDown", -40, -20, 2);
    expect(spectrumMarker.style.left).toBe("0%");
    expect(spectrumMarker.style.top).toBe("0%");
    drag(spectrum, "pointerMove", 160, 140, 2);
    expect(spectrumMarker.style.left).toBe("100%");
    expect(spectrumMarker.style.top).toBe("100%");
    drag(spectrum, "pointerUp", 160, 140, 2);
  });

  it("ignores non-primary and right-button pointers and honors only the active pointer", () => {
    const { onChange } = renderPicker();
    const { hue, hueMarker, spectrum } = getControls();
    const startCalls = onChange.mock.calls.length;

    fireEvent.pointerDown(hue, { button: 2, clientX: 110, clientY: 158, pointerId: 9 });
    fireEvent.pointerDown(hue, {
      button: 0,
      clientX: 110,
      clientY: 158,
      isPrimary: false,
      pointerId: 8,
    });
    expect(onChange).toHaveBeenCalledTimes(startCalls);

    drag(hue, "pointerDown", 10, 158, 1);
    const activeHuePosition = hueMarker.style.left;
    fireEvent.pointerDown(hue, {
      button: 0,
      clientX: 110,
      clientY: 158,
      isPrimary: true,
      pointerId: 2,
    });
    drag(hue, "pointerMove", 110, 158, 2);
    expect(hueMarker.style.left).toBe(activeHuePosition);
    fireEvent.pointerDown(spectrum, {
      button: 0,
      clientX: 60,
      clientY: 70,
      isPrimary: false,
      pointerId: 2,
    });
    drag(spectrum, "pointerMove", 60, 70, 2);
    expect(hueMarker.style.left).toBe("0%");
    expect(onChange).toHaveBeenCalledTimes(startCalls + 1);
    drag(hue, "pointerUp", 10, 158, 1);

    drag(spectrum, "pointerDown", 60, 70, 3);
    drag(spectrum, "pointerUp", 60, 70, 3);
    drag(hue, "pointerDown", 110, 158, 4);
    drag(hue, "pointerCancel", 110, 158, 4);
  });

  it("restores the exact latest HSV commit on pointer cancellation", () => {
    const { onChange, onCommit } = renderPicker();
    const { hue, hueMarker } = getControls();

    drag(hue, "pointerDown", 110, 158);
    drag(hue, "pointerUp", 110, 158);
    expect(hueMarker.style.left).toBe("100%");

    drag(hue, "pointerDown", 10, 158, 2);
    drag(hue, "pointerCancel", 10, 158, 2);

    expect(hueMarker.style.left).toBe("100%");
    expect(onChange).toHaveBeenLastCalledWith("#e14242");
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("restores the exact latest committed color after lost pointer capture", () => {
    const { onChange, onCommit } = renderPicker();
    const { hue, hueMarker, spectrum } = getControls();

    drag(hue, "pointerDown", 97.5, 158);
    drag(hue, "pointerUp", 97.5, 158);
    drag(spectrum, "pointerDown", 10, 20, 2);
    drag(spectrum, "pointerUp", 10, 20, 2);
    const committedHuePosition = hueMarker.style.left;

    drag(hue, "pointerDown", 10, 158, 3);
    fireEvent.lostPointerCapture(hue, { pointerId: 3 });

    expect(hueMarker.style.left).toBe(committedHuePosition);
    expect(onChange).toHaveBeenLastCalledWith("#ffffff");
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it("commits once on pointerup and ignores a later lost-capture event", () => {
    const { onChange, onCommit } = renderPicker();
    const { hue } = getControls();

    drag(hue, "pointerDown", 75, 158);
    drag(hue, "pointerMove", 85, 158);
    drag(hue, "pointerUp", 85, 158);
    const changeCount = onChange.mock.calls.length;
    fireEvent.lostPointerCapture(hue, { pointerId: 1 });

    expect(onCommit).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledTimes(changeCount);
  });

  it("restores preview on unmount only when an interaction is active", () => {
    const { onChange, onCommit, unmount } = renderPicker();
    const { hue } = getControls();

    drag(hue, "pointerDown", 110, 158);
    expect(onChange).toHaveBeenLastCalledWith("#e14242");
    unmount();

    expect(onChange).toHaveBeenLastCalledWith("#4299e1");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not restore preview on unmount after a pointer interaction completes", () => {
    const { onChange, onCommit, unmount } = renderPicker();
    const { hue } = getControls();

    drag(hue, "pointerDown", 75, 158);
    drag(hue, "pointerUp", 75, 158);
    const changeCount = onChange.mock.calls.length;
    unmount();

    expect(onCommit).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledTimes(changeCount);
  });

  it("changes and commits keyboard adjustments", () => {
    const { onChange, onCommit } = renderPicker();
    const { spectrum } = getControls();

    fireEvent.keyDown(spectrum, { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(onCommit.mock.calls[0]?.[0]);
  });
});

function getControlsForDefault(defaultValue: HexColor = "#4299e1") {
  renderPicker({ defaultValue });
  return getControls();
}
