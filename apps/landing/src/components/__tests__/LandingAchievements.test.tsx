import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  onboardingAchievements,
  onboardingLoopTiming,
} from "../../consts/onboarding-achievements.consts";
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
});
