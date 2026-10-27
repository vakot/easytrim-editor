import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  onboardingAchievements,
  onboardingLoopTiming,
} from "../../consts/onboarding-achievements.consts";
import { REVEAL_ANIMATION_NAME } from "../../lib/reveal.utils";
import { stubIntersectionObserver } from "../../test/intersection-observer.mock";
import { LandingAchievements } from "../LandingAchievements";

const { exitMs, toastMs } = onboardingLoopTiming;

function slot(name: "current-toast" | "leaving-toast") {
  return document.querySelector<HTMLElement>(`[data-slot='${name}']`);
}

function title(element: HTMLElement | null) {
  return element?.querySelector("[data-slot='achievement-unlock-title']")?.textContent ?? null;
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function preferReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches: reduce && query.includes("reduce"),
      media: query,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

describe("LandingAchievements", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    preferReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows only the toast, starting with the first Getting Started achievement", () => {
    render(<LandingAchievements />);

    expect(title(slot("current-toast"))).toBe(onboardingAchievements[0]!.title);
    expect(document.querySelector("[data-slot='item']")).toBeNull();
    expect(screen.queryByText("Getting Started")).not.toBeInTheDocument();
  });

  it("hands over to the next toast while the previous one fades out", () => {
    render(<LandingAchievements />);
    const first = slot("current-toast");

    advance(toastMs);

    expect(title(slot("current-toast"))).toBe(onboardingAchievements[1]!.title);
    expect(slot("leaving-toast")).toBe(first);
    expect(slot("leaving-toast")).toHaveAttribute("aria-hidden", "true");
    expect(slot("leaving-toast")).toHaveClass("animate-out", "fade-out");

    advance(exitMs);
    expect(slot("leaving-toast")).toBeNull();
  });

  it("starts over after the last achievement", () => {
    render(<LandingAchievements />);

    onboardingAchievements.forEach(() => advance(toastMs));

    expect(title(slot("current-toast"))).toBe(onboardingAchievements[0]!.title);
    expect(title(slot("leaving-toast"))).toBe(onboardingAchievements.at(-1)!.title);
  });

  it("stops advancing while paused and resumes when played", () => {
    render(<LandingAchievements />);

    fireEvent.click(screen.getByRole("button", { name: "Pause the preview" }));
    advance(toastMs * 3);
    expect(title(slot("current-toast"))).toBe(onboardingAchievements[0]!.title);

    fireEvent.click(screen.getByRole("button", { name: "Play the preview" }));
    advance(toastMs);
    expect(title(slot("current-toast"))).toBe(onboardingAchievements[1]!.title);
  });

  it("shows a still toast for visitors who prefer reduced motion", () => {
    preferReducedMotion(true);
    render(<LandingAchievements />);

    expect(screen.getByRole("button", { name: "Play the preview" })).toBeInTheDocument();
    expect(title(slot("current-toast"))).toBe(onboardingAchievements[0]!.title);

    advance(toastMs * 3);
    expect(title(slot("current-toast"))).toBe(onboardingAchievements[0]!.title);
  });

  it("swaps toasts without an exit animation once a reduced-motion visitor plays", () => {
    preferReducedMotion(true);
    render(<LandingAchievements />);

    fireEvent.click(screen.getByRole("button", { name: "Play the preview" }));
    advance(toastMs);

    expect(title(slot("current-toast"))).toBe(onboardingAchievements[1]!.title);
    expect(slot("leaving-toast")).toBeNull();
  });

  describe("with intersection observers", () => {
    function endAnimation(target: Element, animationName: string) {
      const event = new Event("animationend", { bubbles: true });

      Object.defineProperty(event, "animationName", { value: animationName });
      act(() => {
        target.dispatchEvent(event);
      });
    }

    function scrollIntoView(mock: ReturnType<typeof stubIntersectionObserver>) {
      act(() => {
        for (const observer of mock.instances) observer.show([...observer.observed]);
      });
    }

    it("waits for the panel to finish appearing before the first toast arrives", () => {
      const mock = stubIntersectionObserver();
      render(<LandingAchievements />);
      const panel = screen.getByRole("region", { name: "Achievement unlock preview" });

      expect(slot("current-toast")).toBeNull();
      scrollIntoView(mock);
      expect(panel).toHaveAttribute("data-revealed");
      expect(slot("current-toast")).toBeNull();

      endAnimation(panel, REVEAL_ANIMATION_NAME);
      expect(title(slot("current-toast"))).toBe(onboardingAchievements[0]!.title);
    });

    it("ignores animations that finish inside the panel", () => {
      const mock = stubIntersectionObserver();
      render(<LandingAchievements />);
      scrollIntoView(mock);

      endAnimation(screen.getByRole("button", { name: "Pause the preview" }), "enter");
      endAnimation(
        screen.getByRole("region", { name: "Achievement unlock preview" }),
        "something-else",
      );

      expect(slot("current-toast")).toBeNull();
    });

    it("shows the toast straight away for visitors who prefer reduced motion", () => {
      preferReducedMotion(true);
      const mock = stubIntersectionObserver();
      render(<LandingAchievements />);

      scrollIntoView(mock);

      expect(title(slot("current-toast"))).toBe(onboardingAchievements[0]!.title);
    });
  });
});
