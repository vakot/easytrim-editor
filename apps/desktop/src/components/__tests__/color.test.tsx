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
    const onChange = vi.fn();
    const onCommit = vi.fn();

    render(
      <ColorPicker defaultValue="#4299e1" onChange={onChange} onCommit={onCommit}>
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

    expect(onChange).toHaveBeenCalledWith("#efbf04");
    expect(onCommit).toHaveBeenCalledWith("#efbf04");
    expect(screen.getByRole("textbox", { name: "Primary color HEX" })).toHaveValue("efbf04");
    expect(getMarkers().spectrumMarker.style.backgroundColor).not.toBe(initialSpectrumColor);
    expect(getMarkers().hueMarker.style.left).not.toBe(initialHuePosition);
  });

  it("keeps incomplete HEX drafts local and changes then commits valid HEX input", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();

    render(
      <ColorPicker defaultValue="#4299e1" onChange={onChange} onCommit={onCommit}>
        <ColorPickerInput aria-label="Primary color HEX" />
      </ColorPicker>,
    );

    const input = screen.getByRole("textbox", { name: "Primary color HEX" });
    fireEvent.change(input, { target: { value: "abc12" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "ABCDEF" } });

    expect(onChange).toHaveBeenCalledWith("#abcdef");
    expect(onCommit).toHaveBeenCalledWith("#abcdef");
  });

  it("changes during spectrum movement and commits once on pointer release", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();

    render(
      <ColorPicker defaultValue="#4299e1" onChange={onChange} onCommit={onCommit}>
        <ColorPickerSpectrum aria-label="Primary color" />
      </ColorPicker>,
    );

    const field = screen.getByRole("button", {
      name: "Primary color saturation and brightness",
    });

    mockBounds(field, 0, 0, 100, 100);

    fireEvent.pointerDown(field, { button: 0, clientX: 50, clientY: 50, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith("#406380");
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerMove(field, { clientX: 75, clientY: 25, pointerId: 1 });
    fireEvent.pointerUp(field, { clientX: 75, clientY: 25, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith("#307ebf");
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith("#307ebf");
  });

  it("restores the latest committed color on cancellation without committing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCommit = vi.fn();

    render(
      <ColorPicker defaultValue="#4299e1" onChange={onChange} onCommit={onCommit}>
        <ColorPickerSpectrum aria-label="Primary color" />
        <ColorPickerInput aria-label="Primary color HEX" />
        <ColorPickerPreset value="#efbf04">
          <button type="button">Amber</button>
        </ColorPickerPreset>
      </ColorPicker>,
    );

    await user.click(screen.getByRole("button", { name: "Amber" }));
    onChange.mockClear();
    onCommit.mockClear();

    const field = screen.getByRole("button", {
      name: "Primary color saturation and brightness",
    });

    mockBounds(field, 0, 0, 100, 100);
    fireEvent.pointerDown(field, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    expect(getMarkers().spectrumMarker.style.left).toBe("100%");
    const transientPosition = getMarkers().spectrumMarker.style.left;
    fireEvent.pointerCancel(field, { pointerId: 1 });

    expect(onChange).toHaveBeenLastCalledWith("#efbf04");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Primary color HEX" })).toHaveValue("efbf04");
    expect(getMarkers().spectrumMarker.style.left).not.toBe(transientPosition);
  });

  it("restores the committed color when pointer capture is lost", () => {
    const onChange = vi.fn();

    render(
      <ColorPicker defaultValue="#4299e1" onChange={onChange}>
        <ColorPickerSpectrum aria-label="Primary color" />
      </ColorPicker>,
    );

    const field = screen.getByRole("button", {
      name: "Primary color saturation and brightness",
    });

    mockBounds(field, 0, 0, 100, 100);
    const committedPosition = getMarkers().spectrumMarker.style.left;
    fireEvent.pointerDown(field, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.lostPointerCapture(field, { pointerId: 1 });

    expect(onChange).toHaveBeenLastCalledWith("#4299e1");
    expect(getMarkers().spectrumMarker.style.left).toBe(committedPosition);
  });

  it("changes and commits keyboard adjustments", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();

    render(
      <ColorPicker defaultValue="#4299e1" onChange={onChange} onCommit={onCommit}>
        <ColorPickerSpectrum aria-label="Primary color" />
      </ColorPicker>,
    );

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Primary color saturation and brightness" }),
      { key: "ArrowRight" },
    );

    expect(onChange).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(onCommit.mock.calls[0]?.[0]);
  });
});
