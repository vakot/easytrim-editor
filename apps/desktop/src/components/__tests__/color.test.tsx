import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ColorPicker,
  ColorPickerInput,
  ColorPickerPreset,
  ColorPickerSpectrum,
} from "@/components/color";

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
  Object.assign(element, {
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn(),
  });
}

function getMarkers() {
  const spectrum = document.querySelector<HTMLElement>('[data-slot="color-spectrum-field"]')!;
  const hue = document.querySelector<HTMLElement>('[data-slot="color-hue-slider"]')!;
  return {
    spectrumMarker: spectrum.querySelector<HTMLElement>('[data-slot="color-spectrum-marker"]')!,
    hueMarker: hue.querySelector<HTMLElement>('[data-slot="color-hue-marker"]')!,
  };
}

describe("ColorPicker", () => {
  it("routes preset selection through the active picker session", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <ColorPicker defaultValue="#4299e1" onCommit={onCommit}>
        <ColorPickerSpectrum aria-label="Primary color" />
        <ColorPickerInput aria-label="Primary color HEX" />
        <ColorPickerPreset value="#efbf04">
          <button type="button">Amber</button>
        </ColorPickerPreset>
      </ColorPicker>,
    );

    const initialSpectrumColor = getMarkers().spectrumMarker.style.backgroundColor;
    const initialHuePosition = getMarkers().hueMarker.style.left;
    await user.click(screen.getByRole("button", { name: "Amber" }));

    expect(onCommit).toHaveBeenCalledWith("#efbf04");
    expect(screen.getByRole("textbox", { name: "Primary color HEX" })).toHaveValue("efbf04");
    expect(getMarkers().spectrumMarker.style.backgroundColor).not.toBe(initialSpectrumColor);
    expect(getMarkers().hueMarker.style.left).not.toBe(initialHuePosition);
  });

  it("commits valid HEX input to the same color callback", () => {
    const onCommit = vi.fn();

    render(
      <ColorPicker defaultValue="#4299e1" onCommit={onCommit}>
        <ColorPickerInput aria-label="Primary color HEX" />
      </ColorPicker>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Primary color HEX" }), {
      target: { value: "ABCDEF" },
    });

    expect(onCommit).toHaveBeenCalledWith("#abcdef");
  });

  it("previews spectrum movement without committing until pointer release", () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();

    render(
      <ColorPicker defaultValue="#4299e1" onCommit={onCommit} onPreview={onPreview}>
        <ColorPickerSpectrum aria-label="Primary color" />
      </ColorPicker>,
    );

    const field = screen.getByRole("button", {
      name: "Primary color saturation and brightness",
    });

    mockBounds(field, 0, 0, 100, 100);

    fireEvent.pointerDown(field, { button: 0, clientX: 50, clientY: 50, pointerId: 1 });
    expect(onPreview).toHaveBeenCalledWith("#406380");
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(field, { clientX: 50, clientY: 50, pointerId: 1 });
    expect(onCommit).toHaveBeenCalledWith("#406380");
  });

  it("restores the picker state when a spectrum pointer interaction is canceled", () => {
    const onCancel = vi.fn();

    render(
      <ColorPicker defaultValue="#4299e1" onCancel={onCancel}>
        <ColorPickerSpectrum aria-label="Primary color" />
      </ColorPicker>,
    );

    const field = screen.getByRole("button", {
      name: "Primary color saturation and brightness",
    });

    mockBounds(field, 0, 0, 100, 100);
    const initialPosition = getMarkers().spectrumMarker.style.left;

    fireEvent.pointerDown(field, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    expect(getMarkers().spectrumMarker.style.left).toBe("100%");
    fireEvent.pointerCancel(field, { pointerId: 1 });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(getMarkers().spectrumMarker.style.left).toBe(initialPosition);
  });
});
