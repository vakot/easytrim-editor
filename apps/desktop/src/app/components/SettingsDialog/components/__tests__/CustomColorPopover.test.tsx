import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { useAppSelector } from "@/app/store/redux-hooks";
import { preferencesReducer, selectCustomPrimaryColor } from "@/app/store/slices/preferences-slice";
import { ThemeProvider } from "@/app/theme/ThemeProvider";

import {
  CustomColorInput,
  CustomColorPopover,
  CustomColorPopoverContent,
  CustomColorPopoverTrigger,
} from "../CustomColorPopover";

function createStore() {
  return configureStore({
    reducer: { preferences: preferencesReducer },
    preloadedState: {
      preferences: {
        ...DEFAULT_PREFERENCES,
        customPrimaryColor: "#123456" as const,
        primaryColor: "blue" as const,
      },
    },
  });
}

function renderColorPicker() {
  const store = createStore();

  render(
    <Provider store={store}>
      <ThemeProvider>
        <ColorPickerHarness />
      </ThemeProvider>
    </Provider>,
  );

  return store;
}

function ColorPickerHarness() {
  const customColor = useAppSelector(selectCustomPrimaryColor);

  return (
    <CustomColorPopover value={customColor}>
      <CustomColorPopoverTrigger asChild>
        <button type="button">Choose custom color</button>
      </CustomColorPopoverTrigger>
      <CustomColorPopoverContent>
        <CustomColorInput aria-label="Custom hex" />
      </CustomColorPopoverContent>
    </CustomColorPopover>
  );
}

function prepareSpectrumWheel() {
  const wheel = screen.getByRole("button", { name: /Theme color spectrum/ });

  Object.defineProperty(wheel, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(0, 0, 192, 192),
  });
  Object.assign(wheel, {
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn(),
  });

  return wheel;
}

describe("CustomColorPopover", () => {
  it("previews wheel scrubbing without dispatching and cancels without closing", async () => {
    const user = userEvent.setup();
    const store = renderColorPicker();
    const dispatch = vi.spyOn(store, "dispatch");

    await user.click(screen.getByRole("button", { name: "Choose custom color" }));

    const wheel = prepareSpectrumWheel();
    fireEvent.pointerDown(wheel, { clientX: 96, clientY: 96, pointerId: 1 });

    expect(document.documentElement).toHaveAttribute("data-primary-color-scrubbing");
    expect(document.documentElement).toHaveAttribute("data-primary-color", "#808080");
    expect(document.documentElement.style.getPropertyValue("--primary-color-preview")).toBe(
      "#808080",
    );
    expect(store.getState().preferences.primaryColor).toBe("blue");
    expect(store.getState().preferences.customPrimaryColor).toBe("#123456");
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.pointerCancel(wheel, { pointerId: 1 });

    expect(screen.getByRole("textbox", { name: "Custom hex" })).toHaveValue("123456");
    expect(document.documentElement).not.toHaveAttribute("data-primary-color-scrubbing");
    expect(document.documentElement).toHaveAttribute("data-primary-color", "blue");
    expect(document.documentElement.style.getPropertyValue("--primary-color-preview")).toBe("");
    expect(store.getState().preferences.primaryColor).toBe("blue");
    expect(screen.getByRole("button", { name: /Theme color spectrum/ })).toBeVisible();
    expect(
      screen
        .getByRole("button", { name: /Theme color spectrum/ })
        .querySelector('[data-slot="spectrum-wheel-marker"]'),
    ).toHaveStyle({
      backgroundColor: "rgb(18, 52, 86)",
    });
  });

  it("persists a released wheel color and uses it as the next cancellation baseline", async () => {
    const user = userEvent.setup();
    const store = renderColorPicker();

    await user.click(screen.getByRole("button", { name: "Choose custom color" }));

    let wheel = prepareSpectrumWheel();
    fireEvent.pointerDown(wheel, { clientX: 96, clientY: 96, pointerId: 1 });
    fireEvent.pointerUp(wheel, { clientX: 96, clientY: 96, pointerId: 1 });

    expect(store.getState().preferences.primaryColor).toBe("#808080");
    expect(store.getState().preferences.customPrimaryColor).toBe("#808080");
    expect(document.documentElement).toHaveAttribute("data-primary-color", "#808080");
    expect(document.documentElement).not.toHaveAttribute("data-primary-color-scrubbing");

    wheel = prepareSpectrumWheel();
    fireEvent.pointerDown(wheel, { clientX: 0, clientY: 0, pointerId: 2 });
    fireEvent.pointerCancel(wheel, { pointerId: 2 });

    expect(store.getState().preferences.primaryColor).toBe("#808080");
    expect(document.documentElement).toHaveAttribute("data-primary-color", "#808080");
    expect(document.documentElement).not.toHaveAttribute("data-primary-color-scrubbing");
  });

  it("sanitizes HEX edits, commits complete colors, and discards incomplete drafts on close", async () => {
    const user = userEvent.setup();
    const store = renderColorPicker();

    await user.click(screen.getByRole("button", { name: "Choose custom color" }));

    const input = screen.getByRole("textbox", { name: "Custom hex" });
    fireEvent.change(input, { target: { value: "FF00" } });
    expect(input).toHaveValue("FF00");
    expect(store.getState().preferences.customPrimaryColor).toBe("#123456");
    expect(store.getState().preferences.primaryColor).toBe("blue");

    fireEvent.change(input, { target: { value: "#aB-cD99zz" } });
    expect(input).toHaveValue("abcd99");
    expect(store.getState().preferences.customPrimaryColor).toBe("#abcd99");
    expect(store.getState().preferences.primaryColor).toBe("#abcd99");
    expect(document.documentElement).toHaveAttribute("data-primary-color", "#abcd99");
    expect(document.documentElement).not.toHaveAttribute("data-primary-color-scrubbing");
    expect(
      screen
        .getByRole("button", { name: /Theme color spectrum/ })
        .querySelector('[data-slot="spectrum-wheel-marker"]'),
    ).toHaveStyle({
      backgroundColor: "rgb(171, 205, 153)",
    });

    fireEvent.change(input, { target: { value: "F" } });
    expect(input).toHaveValue("F");
    expect(store.getState().preferences.customPrimaryColor).toBe("#abcd99");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Custom hex" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Choose custom color" }));
    expect(screen.getByRole("textbox", { name: "Custom hex" })).toHaveValue("abcd99");
    expect(store.getState().preferences.customPrimaryColor).toBe("#abcd99");
    expect(document.documentElement).not.toHaveAttribute("data-primary-color-scrubbing");
  });
});
