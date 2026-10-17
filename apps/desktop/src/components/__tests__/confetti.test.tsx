import { render } from "@testing-library/react";
import { animate } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  afterEach(() => vi.restoreAllMocks());

  it.each(["center", "border-outside", "border-inside"] as const)(
    "starts particles at the expected origin and moves them for %s",
    (mode) => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        width: 320,
        height: 160,
      } as DOMRect);
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      vi.mocked(animate).mockClear();
      const { container } = render(<Confetti active mode={mode} />);
      const layer = container.querySelector("[data-slot='confetti']");
      expect(layer).toHaveClass(mode === "border-outside" ? "overflow-visible" : "overflow-hidden");
      for (const call of vi.mocked(animate).mock.calls) {
        const frames = (call[1] as { transform: string[] }).transform;
        const coordinates = frames.slice(-11).map((frame) => {
          const match = /translate\((-?[\d.]+)rem, (-?[\d.]+)rem\)/.exec(frame)!;
          return [Number(match[1]), Number(match[2])];
        });

        const [x, y] = coordinates[0]!;
        if (mode === "center") {
          expect([x, y]).toEqual([0, 0]);
        } else {
          expect(Math.abs(x!) === 10 || Math.abs(y!) === 5).toBe(true);
          for (const [step, [nextX, nextY]] of coordinates.slice(1).entries()) {
            if (mode === "border-inside") {
              expect(Math.abs(nextX!)).toBeLessThanOrEqual(10);
              expect(Math.abs(nextY!)).toBeLessThanOrEqual(5);
            } else if (step === 0) {
              expect(Math.abs(nextX!) > 10 || Math.abs(nextY!) > 5).toBe(true);
            }
          }
        }
      }
    },
  );

  it.each([
    ["border-outside", 320, 160, [15, 7, 15, 7]],
    ["border-inside", 320, 160, [15, 7, 15, 7]],
    ["border-outside", 160, 320, [7, 15, 7, 15]],
    ["border-inside", 160, 320, [7, 15, 7, 15]],
    ["border-inside", 160, 160, [11, 11, 11, 11]],
    ["border-outside", 1600, 16, [22, 0, 22, 0]],
  ] as const)(
    "distributes %s particles by edge length in a %s by %s host",
    (mode, width, height, expectedCounts) => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        width,
        height,
      } as DOMRect);
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      vi.mocked(animate).mockClear();
      render(<Confetti active mode={mode} />);
      const calls = vi.mocked(animate).mock.calls;
      const origins = calls.map((call) => (call[1] as { transform: string[] }).transform[0]);
      const edges = [
        `translate(0.000rem, ${(-height / 32).toFixed(3)}rem) rotate(0deg)`,
        `translate(${(width / 32).toFixed(3)}rem, 0.000rem) rotate(0deg)`,
        `translate(0.000rem, ${(height / 32).toFixed(3)}rem) rotate(0deg)`,
        `translate(${(-width / 32).toFixed(3)}rem, 0.000rem) rotate(0deg)`,
      ];

      expect(calls).toHaveLength(44);
      expect(edges.map((edge) => origins.filter((origin) => origin === edge).length)).toEqual(
        expectedCounts,
      );
      for (const [edgeIndex, edge] of edges.entries()) {
        const edgeCalls = calls.filter((_, index) => origins[index] === edge);
        if (edgeCalls.length === 0) continue;
        const launchTimes = edgeCalls.map((call) => {
          const options = call[2] as { duration: number; times?: number[] };
          return options.times ? options.times[2]! * options.duration : 0;
        });

        expect(launchTimes[0]).toBe(0);
        expect(launchTimes.at(-1)).toBeCloseTo(0.8);
        // Integer particle allocation stays within one particle of the ideal density.
        const length = edgeIndex % 2 === 0 ? width : height;
        expect(Math.abs(edgeCalls.length - (44 * length) / (2 * (width + height)))).toBeLessThan(1);
      }
    },
  );

  it.each(["border-inside", "border-outside"] as const)(
    "keeps %s launch ranges consistent throughout emission",
    (mode) => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        width: 640,
        height: 160,
      } as DOMRect);
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      vi.mocked(animate).mockClear();
      render(<Confetti active mode={mode} />);
      const edgeRanges: number[][] = [[], [], [], []];
      for (const call of vi.mocked(animate).mock.calls) {
        const frames = (call[1] as { transform: string[] }).transform;
        const coordinates = frames.slice(-11).map((frame) => {
          const match = /translate\((-?[\d.]+)rem, (-?[\d.]+)rem\)/.exec(frame)!;
          return [Number(match[1]), Number(match[2])];
        });

        const [x, y] = coordinates[0]!;
        const edge = y === -5 ? 0 : x === 20 ? 1 : y === 5 ? 2 : 3;
        edgeRanges[edge]!.push(
          Math.max(...coordinates.map(([nextX, nextY]) => Math.hypot(nextX! - x!, nextY! - y!))),
        );
      }
      expect(edgeRanges[1]![0]).toBeCloseTo(edgeRanges[3]![0]!);
      for (const ranges of edgeRanges) {
        expect(ranges[0]).toBeGreaterThan(0);
        for (let index = 1; index < ranges.length; index += 1) {
          expect(ranges[index]).toBeCloseTo(ranges[0]!);
        }
      }
    },
  );

  it("pulls particles below their starting height with full upward launch strength", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 320,
      height: 160,
    } as DOMRect);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.mocked(animate).mockClear();
    render(<Confetti active />);
    for (const call of vi.mocked(animate).mock.calls) {
      const frames = (call[1] as { transform: string[] }).transform.slice(-11);
      const heights = frames.map((frame) =>
        Number(/translate\(-?[\d.]+rem, (-?[\d.]+)rem\)/.exec(frame)![1]),
      );

      expect(heights.at(-1)).toBeGreaterThan(0);
      expect(heights.at(-1)).toBeGreaterThan(heights.at(-2)!);
    }
  });

  it.each([0, 0.3])(
    "launches sparse four-particle bursts over half the duration after a %s second delay",
    (delay) => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      vi.mocked(animate).mockClear();
      render(<Confetti active delay={delay} duration={2} intensity="subtle" />);

      const calls = vi.mocked(animate).mock.calls;
      expect(calls).toHaveLength(18);
      calls.forEach((call, index) => {
        const options = call[2] as { duration: number; times?: number[] };
        const frames = call[1] as { opacity: number[] };
        const expectedDelay = delay + Math.floor(index / 4) / 4;
        const actualDelay = options.times ? options.times[2]! * options.duration : 0;
        expect(actualDelay).toBeCloseTo(expectedDelay);
        expect(options.duration - actualDelay).toBeCloseTo(1.75);
        if (expectedDelay > 0) expect(frames.opacity.slice(0, 2)).toEqual([0, 0]);
      });
    },
  );

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
