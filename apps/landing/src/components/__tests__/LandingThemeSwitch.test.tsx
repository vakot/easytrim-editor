import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "../../hooks/useLandingTheme";
import { LandingThemeSwitch } from "../LandingThemeSwitch";

const root = document.documentElement;

function preferDarkSystem(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      matches: dark && query.includes("dark"),
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
});
