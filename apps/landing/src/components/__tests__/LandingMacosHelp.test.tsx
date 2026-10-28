import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** The dialog module is cached once loaded, so each test starts from a fresh copy of the button. */
async function renderHelp() {
  vi.resetModules();
  const { LandingMacosHelp } = await import("../LandingMacosHelp");

  render(<LandingMacosHelp />);
  return screen.getByRole("button", { name: "Can’t open it on macOS?" });
}

describe("LandingMacosHelp", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("opens the dialog in the same frame once the visitor has hovered the button", async () => {
    const button = await renderHelp();

    fireEvent.pointerEnter(button);
    await vi.dynamicImportSettled();
    fireEvent.click(button);

    expect(screen.getByRole("dialog", { name: "Opening EasyTrim Editor on macOS" })).toBeVisible();
  });

  it("preloads the dialog when the button takes focus", async () => {
    const button = await renderHelp();

    fireEvent.focus(button);
    await vi.dynamicImportSettled();
    fireEvent.click(button);

    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("loads the dialog on demand when it was never hovered", async () => {
    const button = await renderHelp();

    fireEvent.click(button);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog")).toBeVisible();
  });
});
