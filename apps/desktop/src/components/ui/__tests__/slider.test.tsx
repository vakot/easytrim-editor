import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slider } from "../slider";

function bounds(element: Element, left: number, width = 0, top = 0, height = 20) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON() {},
  });
}

function setup({
  marker = true,
  max = 100,
  snap = "shift",
  snapTarget = true,
}: { marker?: boolean; max?: number; snap?: boolean | "shift"; snapTarget?: boolean } = {}) {
  const change = vi.fn();
  const commit = vi.fn();
  render(
    <Slider.Group>
      <Slider.Root
        data-testid="active"
        defaultValue={[10]}
        max={max}
        onValueChange={change}
        onValueCommit={commit}
        snap={snap}
      >
        <Slider.Track />
        <Slider.Thumb aria-label="Active" />
      </Slider.Root>
      {marker ? (
        <Slider.Marker data-testid="target" value={50} />
      ) : (
        <Slider.Root snapTarget={snapTarget} value={[50]}>
          <Slider.Thumb aria-label="Other" data-testid="target" />
        </Slider.Root>
      )}
    </Slider.Group>,
  );
  const root = screen.getByTestId("active");
  bounds(root, 0, 100);
  bounds(screen.getByTestId("target"), 50);
  bounds(screen.getByRole("slider", { name: "Active" }), 10);
  return { root, change, commit };
}

function drag(root: HTMLElement, shiftKey = true, clientX = 46) {
  fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX, shiftKey });
  fireEvent.pointerUp(root, { pointerId: 1, clientX, shiftKey });
}

describe("Slider snapping", () => {
  it("ignores secondary buttons and non-primary pointers", () => {
    const { change, root } = setup();
    fireEvent.pointerDown(root, { button: 2, pointerId: 1, clientX: 46, shiftKey: true });
    fireEvent.pointerDown(root, { button: 0, isPrimary: false, pointerId: 2, clientX: 46 });
    expect(change).not.toHaveBeenCalled();
  });
  it("preserves a thumb's grab offset and still reaches both endpoints", () => {
    const change = vi.fn();
    render(
      <Slider.Root data-testid="grab" defaultValue={[50]} onValueChange={change}>
        <Slider.Thumb aria-label="Grab">
          <span data-testid="grip" />
        </Slider.Thumb>
      </Slider.Root>,
    );
    const root = screen.getByTestId("grab");
    const grip = screen.getByTestId("grip");
    bounds(root, 0, 100);
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: 57 });
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "50");
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 67 });
    expect(change).toHaveBeenLastCalledWith([60]);
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 120 });
    expect(change).toHaveBeenLastCalledWith([100]);
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: -20 });
    expect(change).toHaveBeenLastCalledWith([0]);
  });

  it("accounts for rendered thumb insets when snapping", () => {
    const { change, root } = setup();
    bounds(screen.getByRole("slider", { name: "Active" }), 0, 12);
    bounds(screen.getByTestId("target"), 28);
    drag(root, true, 24);
    expect(change).toHaveBeenLastCalledWith([25]);
  });

  it("snaps to markers and commits the snapped value for an uncontrolled slider", () => {
    const { change, commit, root } = setup();
    drag(root);
    expect(change).toHaveBeenLastCalledWith([50]);
    expect(commit).toHaveBeenLastCalledWith([50]);
    expect(screen.getByRole("slider", { name: "Active" })).toHaveAttribute("aria-valuenow", "50");
  });
  it("snaps to another root's thumb in a shared group", () => {
    const { change, root } = setup({ marker: false });
    drag(root);
    expect(change).toHaveBeenLastCalledWith([50]);
  });
  it("excludes roots opted out of target registration", () => {
    const { change, root } = setup({ marker: false, snapTarget: false });
    drag(root);
    expect(change).toHaveBeenLastCalledWith([46]);
  });
  it("requires Shift when configured and never snaps keyboard edits", () => {
    const { change, root } = setup();
    drag(root, false);
    expect(change).toHaveBeenLastCalledWith([46]);
    fireEvent.lostPointerCapture(root);
    fireEvent.keyDown(screen.getByRole("slider", { name: "Active" }), { key: "ArrowRight" });
    expect(change).toHaveBeenLastCalledWith([47]);
  });
  it("maps cross-root physical positions into the active numeric range", () => {
    const { change, root } = setup({ max: 200 });
    drag(root);
    expect(change).toHaveBeenLastCalledWith([100]);
  });
  it("does not snap to targets outside its physical range or threshold", () => {
    const { change, root } = setup({ snap: true });
    drag(root, false, 20);
    expect(change).toHaveBeenLastCalledWith([20]);
    bounds(screen.getByTestId("target"), 110);
    drag(root, false, 99);
    expect(change).toHaveBeenLastCalledWith([99]);
  });
  it("clears feedback on cancellation", () => {
    const { root } = setup({ snap: true });
    fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 46 });
    expect(root).toHaveAttribute("data-snap-active", "true");
    fireEvent.pointerCancel(root, { pointerId: 1 });
    expect(root).not.toHaveAttribute("data-snap-active");
  });
  it("snaps to legacy Markers in its own root without a group", () => {
    const change = vi.fn();
    const { container } = render(
      <Slider.Root data-testid="legacy" defaultValue={[10]} onValueChange={change} snap>
        <Slider.Thumb aria-label="Legacy" />
        <Slider.Markers markers={[{ value: 50, label: "Middle" }]} />
      </Slider.Root>,
    );

    const root = screen.getByTestId("legacy");
    bounds(root, 0, 100);
    bounds(container.querySelector('[data-slot="slider-marker"]')!, 50);
    drag(root, false);
    expect(change).toHaveBeenLastCalledWith([50]);
  });
  it("excludes its own thumb and respects spacing from neighboring thumbs", () => {
    const change = vi.fn();
    render(
      <Slider.Root
        data-testid="range"
        defaultValue={[10, 60]}
        minStepsBetweenThumbs={10}
        onValueChange={change}
        snap
      >
        <Slider.Thumb aria-label="Start" />
        <Slider.Thumb aria-label="End" />
        <Slider.Marker data-testid="close" value={55} />
      </Slider.Root>,
    );
    const root = screen.getByTestId("range");
    bounds(root, 0, 100);
    bounds(screen.getByRole("slider", { name: "Start" }), 46);
    bounds(screen.getByRole("slider", { name: "End" }), 60);
    bounds(screen.getByTestId("close"), 55);
    const start = screen.getByRole("slider", { name: "Start" });
    fireEvent.pointerDown(start, { button: 0, pointerId: 1, clientX: 10 });
    fireEvent.pointerMove(start, { pointerId: 1, clientX: 46 });
    expect(change).toHaveBeenLastCalledWith([46, 60]);
  });
  it.each(["vertical", "rtl"] as const)("maps %s pointer coordinates correctly", (mode) => {
    const change = vi.fn();
    render(
      <Slider.Group>
        <Slider.Root
          data-testid="direction"
          defaultValue={[10]}
          dir={mode === "rtl" ? "rtl" : "ltr"}
          onValueChange={change}
          orientation={mode === "vertical" ? "vertical" : "horizontal"}
          snap
        >
          <Slider.Thumb />
        </Slider.Root>
        <Slider.Marker data-testid="direction-target" value={70} />
      </Slider.Group>,
    );
    const root = screen.getByTestId("direction");
    bounds(root, 0, 100, 0, 100);
    bounds(screen.getByTestId("direction-target"), 30, 0, 30, 0);
    fireEvent.pointerDown(root, { button: 0, pointerId: 1, clientX: 34, clientY: 34 });
    expect(change).toHaveBeenLastCalledWith([70]);
  });
});
