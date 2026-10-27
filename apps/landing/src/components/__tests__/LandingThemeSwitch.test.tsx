import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "../../hooks/useLandingTheme";
import { LandingThemeSwitch } from "../LandingThemeSwitch";

const root = document.documentElement;

function preferDarkSystem(dark: boolean, reducedMotion = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      matches: (dark && query.includes("dark")) || (reducedMotion && query.includes("reduce")),
      media: query,
      removeEventListener: vi.fn(),
    })),
  );
}

describe("LandingThemeSwitch", () => {
  beforeEach(() => {
    localStorage.clear();
    preferDarkSystem(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "startViewTransition");
    root.classList.remove("light", "dark");
    delete root.dataset.theme;
    root.style.removeProperty("color-scheme");
  });

  it("follows the system theme by default", () => {
    render(<LandingThemeSwitch />);

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(root).toHaveClass("dark");
    expect(root).not.toHaveClass("light");
    expect(root.dataset.theme).toBe("dark");
  });

  it("applies and remembers an explicit light or dark choice", () => {
    render(<LandingThemeSwitch />);

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(root).toHaveClass("light");
    expect(root).not.toHaveClass("dark");
    expect(root.style.colorScheme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(root).toHaveClass("dark");
    expect(root).not.toHaveClass("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("forgets the saved choice when switching back to System", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    preferDarkSystem(false);
    render(<LandingThemeSwitch />);

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "System" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(root).not.toHaveClass("light", "dark");
    expect(root.dataset.theme).toBe("light");
  });

  describe("theme change transition", () => {
    /**
     * Records the theme each view transition's update produced, as the browser would capture it,
     * and whether element transitions were paused at that moment. The transition finishes when the
     * test resolves it.
     */
    function supportViewTransitions() {
      const captured: { paused: boolean; theme: string | undefined }[] = [];
      let finish = () => {};
      const startViewTransition = vi.fn((update: () => void) => {
        update();
        captured.push({ paused: "themeSwitching" in root.dataset, theme: root.dataset.theme });
        return { finished: new Promise<void>((resolve) => (finish = resolve)) };
      });

      Object.defineProperty(document, "startViewTransition", {
        configurable: true,
        value: startViewTransition,
      });
      return { captured, finish: () => finish(), startViewTransition };
    }

    it("crossfades a theme change in one view transition with the new theme applied", async () => {
      const { captured, finish, startViewTransition } = supportViewTransitions();
      render(<LandingThemeSwitch />);

      fireEvent.click(screen.getByRole("radio", { name: "Light" }));

      expect(startViewTransition).toHaveBeenCalledTimes(1);
      expect(captured).toEqual([{ paused: true, theme: "light" }]);
      expect(root).toHaveClass("light");

      await act(async () => finish());
      expect("themeSwitching" in root.dataset).toBe(false);
    });

    it("does not start a transition for a choice that resolves to the same theme", () => {
      const { startViewTransition } = supportViewTransitions();
      render(<LandingThemeSwitch />);

      fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

      expect(startViewTransition).not.toHaveBeenCalled();
      expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
      expect(root).toHaveClass("dark");
    });

    it("switches instantly for visitors who prefer reduced motion", () => {
      const { startViewTransition } = supportViewTransitions();
      preferDarkSystem(true, true);
      render(<LandingThemeSwitch />);

      fireEvent.click(screen.getByRole("radio", { name: "Light" }));

      expect(startViewTransition).not.toHaveBeenCalled();
      expect(root).toHaveClass("light");
    });
  });

  describe("compact switch on small screens", () => {
    const toggle = () => screen.getByRole("button", { name: /^Theme:/ });
    const group = () => screen.getByRole("group", { name: "Theme" });

    it("shows only the current theme until it is expanded", () => {
      render(<LandingThemeSwitch />);

      expect(toggle()).toHaveAccessibleName("Theme: System");
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
      expect(group()).toHaveClass("hidden", "sm:flex");

      fireEvent.click(toggle());

      expect(toggle()).toHaveAttribute("aria-expanded", "true");
      expect(group()).toHaveClass("flex");
      expect(screen.getByRole("radio", { name: "System" })).toHaveFocus();
    });

    it("collapses to the new theme once one is chosen with a pointer", () => {
      render(<LandingThemeSwitch />);
      fireEvent.click(toggle());

      const light = screen.getByRole("radio", { name: "Light" }).closest("label")!;
      // Pressing keeps focus in the switch, so blur cannot collapse it before the click lands.
      expect(fireEvent.mouseDown(light)).toBe(false);
      fireEvent.click(light, { detail: 1 });

      expect(group()).toHaveClass("hidden");
      expect(toggle()).toHaveAccessibleName("Theme: Light");
      expect(root).toHaveClass("light");
    });

    it("stays open while browsing with the keyboard and closes on Escape", () => {
      render(<LandingThemeSwitch />);
      fireEvent.click(toggle());

      fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
      expect(group()).toHaveClass("flex");

      fireEvent.keyDown(screen.getByRole("radio", { name: "Dark" }), { key: "Escape" });
      expect(group()).toHaveClass("hidden");
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
    });
  });
});
