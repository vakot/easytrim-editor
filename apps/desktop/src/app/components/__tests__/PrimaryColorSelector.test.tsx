import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { STORAGE_KEYS } from "@/lib/storage";
import { PrimaryColorSelector } from "../PrimaryColorSelector";

describe("PrimaryColorSelector", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("updates the primary color, exposes its selection, and persists it with theme preferences", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <PrimaryColorSelector />
        </ThemeProvider>
      </TooltipProvider>,
    );

    expect(document.documentElement).toHaveAttribute("data-primary-color", "amber");
    await user.click(screen.getByRole("button", { name: "Theme color: Amber" }));
    await user.click(screen.getByRole("button", { name: "Use Blue theme color" }));

    expect(document.documentElement).toHaveAttribute("data-primary-color", "blue");
    expect(screen.getByRole("button", { name: "Theme color: Blue" })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) ?? "{}")).toMatchObject({
      primaryColor: "blue",
    });
  });

  it("restores a saved color on load", () => {
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify({ primaryColor: "emerald" }));
    render(
      <TooltipProvider>
        <ThemeProvider>
          <PrimaryColorSelector />
        </ThemeProvider>
      </TooltipProvider>,
    );

    expect(document.documentElement).toHaveAttribute("data-primary-color", "emerald");
  });

  it("continuously updates and persists a color while scrubbing the spectrum wheel", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <ThemeProvider>
          <PrimaryColorSelector />
        </ThemeProvider>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Theme color: Amber" }));
    const spectrum = screen.getByRole("button", { name: /Theme color spectrum/ });
    Object.defineProperty(spectrum, "getBoundingClientRect", {
      value: () => new DOMRect(0, 0, 192, 192),
    });
    fireEvent.pointerDown(spectrum, { pointerId: 1, clientX: 96, clientY: 96 });
    expect(document.documentElement).toHaveAttribute("data-primary-color", "#808080");
    expect(spectrum.querySelector("span")).toHaveStyle({ left: "50%", top: "50%" });
    const startingColor = document.documentElement.dataset.primaryColor;
    fireEvent.pointerMove(spectrum, { pointerId: 1, clientX: 96, clientY: 12 });
    fireEvent.pointerUp(spectrum, { pointerId: 1 });

    const selectedColor = document.documentElement.dataset.primaryColor;
    expect(selectedColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(selectedColor).not.toBe(startingColor);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) ?? "{}")).toMatchObject({
      primaryColor: selectedColor,
    });
  });
});
