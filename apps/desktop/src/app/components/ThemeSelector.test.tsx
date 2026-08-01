import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { ThemeSelector } from "./ThemeSelector";

describe("ThemeSelector", () => {
  it("switches between runtime themes and can return to the system preference", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeSelector />
      </ThemeProvider>,
    );

    const root = document.documentElement;
    expect(screen.getByRole("combobox").querySelectorAll("svg")).toHaveLength(2);
    expect(root).not.toHaveClass("light", "dark");
    expect(root).toHaveAttribute("data-theme", "light");

    await chooseTheme(user, /Theme: System \(Light\)/, "Light");
    expect(root).toHaveClass("light");
    expect(root).not.toHaveClass("dark");

    await chooseTheme(user, "Theme: Light", "Dark");
    expect(root).toHaveClass("dark");
    expect(root).not.toHaveClass("light");

    await chooseTheme(user, "Theme: Dark", "System");
    expect(root).not.toHaveClass("light", "dark");
    expect(localStorage.getItem("theme")).toBeNull();
  });
});

async function chooseTheme(
  user: ReturnType<typeof userEvent.setup>,
  accessibleName: string | RegExp,
  optionName: string,
) {
  await user.click(screen.getByRole("combobox", { name: accessibleName }));
  expect(screen.getByRole("listbox")).toHaveAttribute("data-align-trigger", "false");
  await user.click(screen.getByRole("option", { name: optionName }));
}
