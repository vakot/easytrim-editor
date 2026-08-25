import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createAppStore } from "@/app/store/store";
import { customPrimaryColorChanged, primaryColorChanged } from "@/app/store/slices/theme-slice";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrimaryColorSelector } from "../PrimaryColorSelector";

describe("PrimaryColorSelector", () => {
  it("updates the primary color, exposes its selection, and persists it with theme preferences", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    render(
      <Provider store={store}>
        <TooltipProvider>
          <ThemeProvider>
            <PrimaryColorSelector />
          </ThemeProvider>
        </TooltipProvider>
      </Provider>,
    );

    expect(document.documentElement).toHaveAttribute("data-primary-color", "amber");
    await user.click(screen.getByRole("button", { name: "Theme color: Amber" }));
    await user.click(screen.getByRole("button", { name: "Use Blue theme color" }));

    expect(document.documentElement).toHaveAttribute("data-primary-color", "blue");
    expect(screen.getByRole("button", { name: "Theme color: Blue" })).toBeVisible();
    expect(store.getState().theme.primaryColor).toBe("blue");
  });

  it("restores a saved color on load", () => {
    const store = createAppStore();
    store.dispatch(primaryColorChanged("emerald"));
    render(
      <Provider store={store}>
        <TooltipProvider>
          <ThemeProvider>
            <PrimaryColorSelector />
          </ThemeProvider>
        </TooltipProvider>
      </Provider>,
    );

    expect(document.documentElement).toHaveAttribute("data-primary-color", "emerald");
  });

  it("continuously updates and persists a color while scrubbing the spectrum wheel", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    render(
      <Provider store={store}>
        <TooltipProvider>
          <ThemeProvider>
            <PrimaryColorSelector />
          </ThemeProvider>
        </TooltipProvider>
      </Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Theme color: Amber" }));
    const spectrum = screen.getByRole("button", { name: /Theme color spectrum/ });
    Object.defineProperty(spectrum, "getBoundingClientRect", {
      value: () => new DOMRect(0, 0, 192, 192),
    });
    fireEvent.pointerDown(spectrum, { pointerId: 1, clientX: 96, clientY: 96 });
    expect(document.documentElement).toHaveAttribute("data-primary-color", "#808080");
    expect(store.getState().theme.primaryColor).toBe("amber");
    expect(spectrum.querySelector("span")).toHaveStyle({ left: "50%", top: "50%" });
    const startingColor = document.documentElement.dataset.primaryColor;
    fireEvent.pointerMove(spectrum, { pointerId: 1, clientX: 96, clientY: 12 });
    fireEvent.pointerUp(spectrum, { pointerId: 1 });

    const selectedColor = document.documentElement.dataset.primaryColor;
    expect(selectedColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(selectedColor).not.toBe(startingColor);
    expect(store.getState().theme.primaryColor).toBe(selectedColor);
    expect(store.getState().theme.customPrimaryColor).toBe(selectedColor);
  });

  it("restores the selected custom color and its palette key", () => {
    const store = createAppStore();
    store.dispatch(customPrimaryColorChanged("#123456"));
    render(
      <Provider store={store}>
        <TooltipProvider>
          <ThemeProvider>
            <PrimaryColorSelector />
          </ThemeProvider>
        </TooltipProvider>
      </Provider>,
    );

    expect(document.documentElement).toHaveAttribute("data-primary-color", "#123456");
    expect(screen.getByRole("button", { name: "Theme color: #123456" })).toBeVisible();
  });
});
