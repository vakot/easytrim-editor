import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Confetti } from "../confetti";

const motion = vi.hoisted(() => ({
  animations: [] as { cancel: ReturnType<typeof vi.fn>; finish: () => void }[],
  reduceMotion: false,
}));

vi.mock("motion/react", () => ({
  animate: vi.fn(() => {
    let finish = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });

    const controls = {
      cancel: vi.fn(),
      finish,
      then: finished.then.bind(finished),
    };

    motion.animations.push(controls);
    return controls;
  }),
  useReducedMotion: () => motion.reduceMotion,
}));

function particles(container: HTMLElement) {
  return container.querySelectorAll("[data-slot='confetti'] > span");
}

describe("Confetti", () => {
  beforeEach(() => {
    motion.animations = [];
    motion.reduceMotion = false;
  });

  it("renders an inert decorative layer without particles until activated", () => {
    const { container } = render(<Confetti active={false} />);

    const layer = container.querySelector("[data-slot='confetti']");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none", "overflow-hidden");
    expect(particles(container)).toHaveLength(0);
    expect(motion.animations).toHaveLength(0);
  });

  it.each([
    ["subtle", 18],
    ["normal", 44],
    ["celebration", 96],
  ] as const)("emits a %s burst of %i particles using theme colors", (intensity, count) => {
    const { container } = render(<Confetti active intensity={intensity} />);

    const nodes = [...particles(container)];
    expect(nodes).toHaveLength(count);
    expect(
      nodes.every((node) => /\bbg-(primary|success|warning|destructive)\b/.test(node.className)),
    ).toBe(true);
    expect(nodes.every((node) => (node as HTMLElement).style.width.endsWith("rem"))).toBe(true);
  });

  it("defaults to the normal intensity", () => {
    const { container } = render(<Confetti active />);

    expect(particles(container)).toHaveLength(44);
  });

  it("lets the host position the layer", () => {
    const { container } = render(<Confetti active={false} className="inset-x-0 top-0 h-16" />);

    expect(container.querySelector("[data-slot='confetti']")).toHaveClass(
      "inset-x-0",
      "top-0",
      "h-16",
    );
  });

  it("removes particles once their animations finish", async () => {
    const { container } = render(<Confetti active intensity="subtle" />);

    for (const animation of motion.animations) animation.finish();
    await vi.waitFor(() => expect(particles(container)).toHaveLength(0));
  });

  it("replays the burst each time it is reactivated", () => {
    const { container, rerender } = render(<Confetti active />);
    expect(particles(container)).toHaveLength(44);

    rerender(<Confetti active={false} />);
    expect(particles(container)).toHaveLength(0);

    rerender(<Confetti active />);
    expect(particles(container)).toHaveLength(44);
    expect(motion.animations).toHaveLength(88);
  });

  it("does not restart when re-rendered with the same props", () => {
    const { rerender } = render(<Confetti active />);
    rerender(<Confetti active />);

    expect(motion.animations).toHaveLength(44);
  });

  it("cancels animations and removes particles on unmount", () => {
    const { container, unmount } = render(<Confetti active />);
    const layer = container.querySelector("[data-slot='confetti']")!;
    const animations = [...motion.animations];

    unmount();

    expect(animations.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true);
    expect(layer.childElementCount).toBe(0);
  });

  it("emits no particles when reduced motion is preferred", () => {
    motion.reduceMotion = true;
    const { container } = render(<Confetti active intensity="celebration" />);

    expect(particles(container)).toHaveLength(0);
    expect(motion.animations).toHaveLength(0);
  });
});
