import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { HexColor } from "@/lib/color.types";

import { ColorSpectrum } from "../color";

function ControlledColorSpectrum({
  initialColor,
  onCancel = vi.fn(),
}: {
  initialColor: HexColor;
  onCancel?: () => void;
}) {
  const [color, setColor] = useState(initialColor);

  return (
    <ColorSpectrum
      aria-label="Color picker"
      color={color}
      onCancel={() => {
        setColor(initialColor);
        onCancel();
      }}
      onCommit={setColor}
      onPreview={setColor}
    />
  );
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
  Object.assign(element, {
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn(),
  });
}

function getControls() {
  const spectrum = screen.getByRole("button", { name: "Saturation and brightness" });
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
  const event = { clientX: x, clientY: y, pointerId };

  if (type === "pointerDown") fireEvent.pointerDown(element, event);
  if (type === "pointerMove") fireEvent.pointerMove(element, event);
  if (type === "pointerUp") fireEvent.pointerUp(element, event);
  if (type === "pointerCancel") fireEvent.pointerCancel(element, event);
}

describe("ColorSpectrum", () => {
  it("keeps both hue endpoints stable and can drag back from the right edge", () => {
    render(<ControlledColorSpectrum initialColor="#4299e1" />);
    const { hue, hueMarker } = getControls();
    const startingHuePosition = hueMarker.style.left;

    fireEvent.pointerDown(hue, { button: 2, clientX: 110, clientY: 158, pointerId: 9 });
    expect(hueMarker.style.left).toBe(startingHuePosition);

    drag(hue, "pointerDown", 10, 158);
    expect(hueMarker).toHaveStyle({ left: "0%" });
    drag(hue, "pointerUp", 10, 158);

    drag(hue, "pointerDown", 110, 158);
    expect(hueMarker).toHaveStyle({ left: "100%" });
    drag(hue, "pointerMove", 60, 158);
    expect(hueMarker).toHaveStyle({ left: "50%" });
    drag(hue, "pointerUp", 60, 158);
  });

  it("clamps captured pointer movement beyond every control edge", () => {
    render(<ControlledColorSpectrum initialColor="#4299e1" />);
    const { hue, hueMarker, spectrum, spectrumMarker } = getControls();

    drag(hue, "pointerDown", -40, 158);
    expect(hueMarker).toHaveStyle({ left: "0%" });
    drag(hue, "pointerMove", 160, 158);
    expect(hueMarker).toHaveStyle({ left: "100%" });
    drag(hue, "pointerUp", 160, 158);

    drag(spectrum, "pointerDown", -40, -20, 2);
    expect(spectrumMarker).toHaveStyle({ left: "0%", top: "0%" });
    drag(spectrum, "pointerMove", 160, 140, 2);
    expect(spectrumMarker).toHaveStyle({ left: "100%", top: "100%" });
    drag(spectrum, "pointerUp", 160, 140, 2);
  });

  it("preserves a selected hue while saturation becomes grayscale and returns", () => {
    render(<ControlledColorSpectrum initialColor="#4299e1" />);
    const { hue, hueMarker, spectrum, spectrumMarker } = getControls();

    drag(hue, "pointerDown", 97.5, 158);
    drag(hue, "pointerUp", 97.5, 158);
    expect(hueMarker).toHaveStyle({ left: "87.5%" });

    drag(spectrum, "pointerDown", 10, 20, 2);
    drag(spectrum, "pointerUp", 10, 20, 2);
    expect(spectrumMarker).toHaveStyle({ left: "0%" });
    expect(hueMarker).toHaveStyle({ left: "87.5%" });

    drag(spectrum, "pointerDown", 40, 20, 3);
    expect(spectrumMarker).toHaveStyle({ left: "30%" });
    expect(hueMarker).toHaveStyle({ left: "87.5%" });
    drag(spectrum, "pointerUp", 40, 20, 3);

    drag(hue, "pointerDown", 60, 158, 4);
    expect(hueMarker).toHaveStyle({ left: "50%" });
    drag(hue, "pointerUp", 60, 158, 4);
  });

  it("preserves hue and saturation while value becomes black and returns", () => {
    render(<ControlledColorSpectrum initialColor="#4299e1" />);
    const { hue, hueMarker, spectrum, spectrumMarker } = getControls();

    drag(hue, "pointerDown", 97.5, 158);
    drag(hue, "pointerUp", 97.5, 158);
    drag(spectrum, "pointerDown", 60, 120, 2);
    expect(spectrumMarker).toHaveStyle({ left: "50%", top: "100%" });
    expect(hueMarker).toHaveStyle({ left: "87.5%" });
    drag(spectrum, "pointerUp", 60, 120, 2);

    drag(hue, "pointerDown", 60, 158, 3);
    expect(hueMarker).toHaveStyle({ left: "50%" });
    drag(hue, "pointerUp", 60, 158, 3);

    drag(spectrum, "pointerDown", 60, 70, 4);
    expect(spectrumMarker).toHaveStyle({ left: "50%", top: "50%" });
    expect(hueMarker).toHaveStyle({ left: "50%" });
    drag(spectrum, "pointerUp", 60, 70, 4);
  });

  it("keeps spectrum and hue marker positions independent through repeated echoed previews", () => {
    render(<ControlledColorSpectrum initialColor="#123456" />);
    const { hue, hueMarker, spectrum, spectrumMarker } = getControls();
    const startingHuePosition = hueMarker.style.left;

    drag(spectrum, "pointerDown", 31.25, 44.75);
    drag(spectrum, "pointerMove", 37.125, 62.375);
    const spectrumPosition = {
      left: spectrumMarker.style.left,
      top: spectrumMarker.style.top,
    };
    expect(hueMarker.style.left).toBe(startingHuePosition);
    drag(spectrum, "pointerMove", 88.875, 12.625);
    drag(spectrum, "pointerMove", 37.125, 62.375);
    expect(hueMarker.style.left).toBe(startingHuePosition);
    expect(spectrumMarker.style.left).toBe(spectrumPosition.left);
    expect(spectrumMarker.style.top).toBe(spectrumPosition.top);
    drag(spectrum, "pointerUp", 37.125, 62.375);

    drag(hue, "pointerDown", 77.125, 158, 2);
    const huePosition = hueMarker.style.left;
    drag(hue, "pointerMove", 24.875, 158, 2);
    expect(spectrumMarker.style.left).toBe(spectrumPosition.left);
    expect(spectrumMarker.style.top).toBe(spectrumPosition.top);
    drag(hue, "pointerMove", 77.125, 158, 2);
    expect(hueMarker.style.left).toBe(huePosition);
    expect(spectrumMarker.style.left).toBe(spectrumPosition.left);
    expect(spectrumMarker.style.top).toBe(spectrumPosition.top);
    drag(hue, "pointerUp", 77.125, 158, 2);
  });

  it("keeps one captured pointer authoritative while allowing sequential control switches", () => {
    const onCancel = vi.fn();
    render(<ControlledColorSpectrum initialColor="#123456" onCancel={onCancel} />);
    const { hue, hueMarker, spectrum } = getControls();

    drag(hue, "pointerDown", 10, 158, 1);
    fireEvent.pointerDown(spectrum, {
      button: 0,
      clientX: 60,
      clientY: 70,
      isPrimary: false,
      pointerId: 2,
    });
    drag(spectrum, "pointerMove", 60, 70, 2);
    expect(hueMarker).toHaveStyle({ left: "0%" });
    expect(hue.releasePointerCapture).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    drag(hue, "pointerUp", 10, 158, 1);

    drag(spectrum, "pointerDown", 60, 70, 3);
    drag(spectrum, "pointerUp", 60, 70, 3);
    drag(hue, "pointerDown", 110, 158, 4);
    drag(hue, "pointerCancel", 110, 158, 4);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(hueMarker).toHaveStyle({ left: `${(210 / 360) * 100}%` });
  });

  it("exposes the hue as a keyboard-operable slider with stable clamped endpoints", () => {
    render(<ControlledColorSpectrum initialColor="#808080" />);
    const { hue, hueMarker, spectrum, spectrumMarker } = getControls();

    expect(screen.getByRole("group", { name: "Color picker" })).toBeVisible();
    expect(spectrum).toHaveAttribute("aria-roledescription", "two-dimensional color selector");
    expect(spectrum).toHaveAccessibleDescription("Saturation 0%; brightness 50%");
    expect(hue).toHaveAttribute("aria-valuemin", "0");
    expect(hue).toHaveAttribute("aria-valuemax", "360");
    expect(hue).toHaveAttribute("aria-valuenow", "0");
    expect(hue).toHaveAttribute("aria-valuetext", "0°");

    fireEvent.keyDown(spectrum, { key: "ArrowLeft" });
    fireEvent.keyDown(spectrum, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(spectrum, { key: "ArrowUp", shiftKey: true });
    expect(spectrumMarker).toHaveStyle({ left: "10%", top: "40%" });

    fireEvent.keyDown(hue, { key: "End" });
    expect(hueMarker).toHaveStyle({ left: "100%" });
    expect(hue).toHaveAttribute("aria-valuenow", "360");
    fireEvent.keyDown(hue, { key: "ArrowRight" });
    expect(hueMarker).toHaveStyle({ left: "100%" });
    fireEvent.keyDown(hue, { key: "Home" });
    fireEvent.keyDown(hue, { key: "ArrowLeft" });
    expect(hueMarker).toHaveStyle({ left: "0%" });
    expect(spectrumMarker).toHaveStyle({ left: "10%", top: "40%" });
  });

  it("restores the starting state if pointer capture is unexpectedly lost", () => {
    const onCancel = vi.fn();
    render(<ControlledColorSpectrum initialColor="#4299e1" onCancel={onCancel} />);
    const { hue, hueMarker } = getControls();
    const startingHuePosition = hueMarker.style.left;

    drag(hue, "pointerDown", 10, 158);
    drag(hue, "pointerMove", 90, 158);
    fireEvent.lostPointerCapture(hue, { pointerId: 1 });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(hueMarker.style.left).toBe(startingHuePosition);
  });

  it("synchronizes genuine external changes while ignoring its own echoed preview", () => {
    const view = render(<ColorSpectrum aria-label="Color picker" color="#4299e1" />);
    const { hueMarker } = getControls();

    view.rerender(<ColorSpectrum aria-label="Color picker" color="#00ff00" />);
    expect(hueMarker).toHaveStyle({ left: `${(120 / 360) * 100}%` });

    view.rerender(<ControlledColorSpectrum initialColor="#4299e1" />);
    const controlled = getControls();
    drag(controlled.hue, "pointerDown", 110, 158);
    expect(controlled.hueMarker).toHaveStyle({ left: "100%" });
    drag(controlled.hue, "pointerMove", 100, 158);
    expect(controlled.hueMarker).toHaveStyle({ left: "90%" });
  });

  it("reopens cleanly after grayscale, black, and custom colors are committed", () => {
    const view = render(<ColorSpectrum aria-label="Color picker" color="#808080" key="#808080" />);
    let controls = getControls();
    expect(controls.hueMarker).toHaveStyle({ left: "0%" });
    drag(controls.hue, "pointerDown", 85, 158);
    drag(controls.hue, "pointerUp", 85, 158);

    view.rerender(<ColorSpectrum aria-label="Color picker" color="#000000" key="#000000" />);
    controls = getControls();
    expect(controls.spectrumMarker).toHaveStyle({ left: "0%", top: "100%" });
    drag(controls.hue, "pointerDown", 85, 158);
    drag(controls.hue, "pointerUp", 85, 158);

    view.rerender(<ColorSpectrum aria-label="Color picker" color="#123456" key="#123456" />);
    controls = getControls();
    expect(controls.hueMarker).toHaveStyle({
      left: `${(210 / 360) * 100}%`,
    });
  });
});
