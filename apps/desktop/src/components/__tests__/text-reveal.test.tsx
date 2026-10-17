import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TextReveal } from "../text-reveal";

type Driver = {
  onComplete: () => void;
  onUpdate: (elapsed: number) => void;
  stop: ReturnType<typeof vi.fn>;
  total: number;
};

const motion = vi.hoisted(() => ({
  drivers: [] as Driver[],
  reduceMotion: false,
}));

vi.mock("motion/react", () => ({
  animate: vi.fn(
    (
      _from: number,
      total: number,
      options: { onComplete: () => void; onUpdate: (elapsed: number) => void },
    ) => {
      const driver = { ...options, stop: vi.fn(), total };
      motion.drivers.push(driver);
      return driver;
    },
  ),
  useReducedMotion: () => motion.reduceMotion,
}));

const glyphs = ["ᔑ", "ʖ", "ᓵ"];

function characterStates(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-slot='text-reveal-char']")].map(
    (slot) => ({
      glyph: slot.querySelector("[data-glyph]")?.textContent ?? "",
      resolved: slot.dataset.resolved,
    }),
  );
}

describe("TextReveal", () => {
  beforeEach(() => {
    motion.drivers = [];
    motion.reduceMotion = false;
  });

  it("exposes the exact text to assistive technology and hides the animated layer", () => {
    const { container } = render(<TextReveal glyphs={glyphs} text="Gold Collector" />);

    expect(container.querySelector(".sr-only")).toHaveTextContent("Gold Collector");
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(container.querySelector(".sr-only")?.closest("[aria-hidden='true']")).toBeNull();
  });

  it("starts every character as a glyph and resolves them left to right", () => {
    const { container } = render(
      <TextReveal glyphs={glyphs} resolveAfter={1} resolveDuration={2} text="Abcd" />,
    );

    const [driver] = motion.drivers;
    expect(driver?.total).toBe(3);
    expect(characterStates(container).every((state) => state.resolved === "false")).toBe(true);
    expect(characterStates(container).every((state) => glyphs.includes(state.glyph))).toBe(true);

    act(() => driver!.onUpdate(0.9));
    expect(characterStates(container).map((state) => state.resolved)).toEqual([
      "false",
      "false",
      "false",
      "false",
    ]);

    act(() => driver!.onUpdate(2));
    expect(characterStates(container).map((state) => state.resolved)).toEqual([
      "true",
      "true",
      "false",
      "false",
    ]);
    expect(characterStates(container)[0]?.glyph).toBe("");

    act(() => driver!.onComplete());
    expect(characterStates(container).every((state) => state.resolved === "true")).toBe(true);
    expect(characterStates(container).every((state) => state.glyph === "")).toBe(true);
  });

  it("restores the exact text for Unicode and non-Latin scripts", () => {
    const text = "Мастер экспорта 🎬 日本語 👨‍👩‍👧 é";
    const { container } = render(<TextReveal glyphs={glyphs} text={text} />);
    act(() => motion.drivers[0]!.onComplete());

    const visible = container.querySelector("[aria-hidden='true']");
    expect(visible?.textContent).toBe(text);
    expect(container.querySelector(".sr-only")?.textContent).toBe(text);
    // Whole emoji sequences are one slot, so they never split mid-character.
    expect(characterStates(container).length).toBe(
      [...new Intl.Segmenter().segment(text)].filter((part) => part.segment.trim() !== "").length,
    );
  });

  it("keeps whitespace as plain text so wrapping matches the final text", () => {
    const { container } = render(<TextReveal glyphs={glyphs} text="a b" />);
    act(() => motion.drivers[0]!.onComplete());

    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe("a b");
    expect(characterStates(container)).toHaveLength(2);
  });

  it("does not animate under reduced motion and keeps the text readable", () => {
    motion.reduceMotion = true;
    const { container } = render(<TextReveal glyphs={glyphs} text="Silent" />);

    expect(motion.drivers).toHaveLength(0);
    expect(characterStates(container).every((state) => state.resolved === undefined)).toBe(true);
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe("Silent");
  });

  it("lets an explicit setting override the system preference", () => {
    motion.reduceMotion = false;
    render(<TextReveal glyphs={glyphs} reducedMotion text="Silent" />);
    expect(motion.drivers).toHaveLength(0);

    motion.reduceMotion = true;
    render(<TextReveal glyphs={glyphs} reducedMotion={false} text="Moving" />);
    expect(motion.drivers).toHaveLength(1);
  });

  it("cycles glyphs on a fixed interval instead of every frame", () => {
    const { container } = render(<TextReveal glyphs={glyphs} resolveAfter={5} text="Abc" />);
    const random = vi.spyOn(Math, "random");
    const driver = motion.drivers[0]!;

    act(() => driver.onUpdate(0.01));
    act(() => driver.onUpdate(0.02));
    act(() => driver.onUpdate(0.03));
    const callsWithinOneInterval = random.mock.calls.length;
    act(() => driver.onUpdate(0.08));

    expect(callsWithinOneInterval).toBe(0);
    expect(random.mock.calls.length).toBe(3);
    expect(characterStates(container).every((state) => glyphs.includes(state.glyph))).toBe(true);
    random.mockRestore();
  });

  it("stops the animation on unmount and replays when the text changes", () => {
    const { rerender, unmount } = render(<TextReveal glyphs={glyphs} text="One" />);
    const first = motion.drivers[0]!;

    rerender(<TextReveal glyphs={glyphs} text="Two" />);
    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(motion.drivers).toHaveLength(2);

    unmount();
    expect(motion.drivers[1]!.stop).toHaveBeenCalledTimes(1);
  });
});
