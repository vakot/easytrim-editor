import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  onboardingAchievements,
  onboardingLoopTiming,
} from "../../consts/onboarding-achievements.consts";
import { LandingAchievements } from "../LandingAchievements";

const { completionMs, startMs, unlockMs } = onboardingLoopTiming;

function cards() {
  return [...document.querySelectorAll<HTMLElement>("[data-slot='item']")];
}

function unlockedCount() {
  return cards().filter((card) => card.dataset.state === "unlocked").length;
}

function toastTitle() {
  return document.querySelector("[data-slot='achievement-unlock-title']")?.textContent ?? null;
}

function completion() {
  return document.querySelector("[data-slot='onboarding-completion']");
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Each step's timer is scheduled after the previous step renders, so advance one at a time. */
function advanceSteps(...durations: number[]) {
  for (const ms of durations) advance(ms);
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

  it("starts with every Getting Started achievement locked", () => {
    render(<LandingAchievements />);

    expect(cards()).toHaveLength(onboardingAchievements.length);
    expect(unlockedCount()).toBe(0);
    expect(toastTitle()).toBeNull();
    expect(screen.getByText(`0 of ${onboardingAchievements.length}`)).toBeInTheDocument();
  });

  it("unlocks the achievements in order, each with its own toast", () => {
    render(<LandingAchievements />);

    advance(startMs);
    expect(unlockedCount()).toBe(1);
    expect(toastTitle()).toBe(onboardingAchievements[0]!.title);
    expect(screen.getByText("Completed")).toBeInTheDocument();

    advance(unlockMs);
    expect(unlockedCount()).toBe(2);
    expect(toastTitle()).toBe(onboardingAchievements[1]!.title);
  });

  it("celebrates completion and then starts over", () => {
    render(<LandingAchievements />);

    advanceSteps(startMs, ...onboardingAchievements.map(() => unlockMs));
    expect(unlockedCount()).toBe(onboardingAchievements.length);
    expect(completion()).not.toBeNull();
    expect(toastTitle()).toBeNull();

    advance(completionMs);
    expect(completion()).toBeNull();
    expect(unlockedCount()).toBe(0);

    advance(startMs);
    expect(toastTitle()).toBe(onboardingAchievements[0]!.title);
  });

  it("stops advancing while paused and resumes when played", () => {
    render(<LandingAchievements />);

    advance(startMs);
    fireEvent.click(screen.getByRole("button", { name: "Pause the preview" }));
    advanceSteps(unlockMs, unlockMs, unlockMs);
    expect(unlockedCount()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Play the preview" }));
    advance(unlockMs);
    expect(unlockedCount()).toBe(2);
  });

  it("shows a still frame for visitors who prefer reduced motion", () => {
    preferReducedMotion(true);
    render(<LandingAchievements />);

    expect(screen.getByRole("button", { name: "Play the preview" })).toBeInTheDocument();
    expect(unlockedCount()).toBe(2);
    expect(toastTitle()).toBe(onboardingAchievements[1]!.title);

    advanceSteps(unlockMs, unlockMs, unlockMs);
    expect(unlockedCount()).toBe(2);
  });
});
