import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  Library,
  LibraryContent,
  LibraryNavigation,
  LibraryNavigationGroup,
  LibraryNavigationItem,
  LibraryPage,
  LibrarySeparator,
} from "@/components/library";

function ControlledLibrary() {
  const [value, setValue] = useState("general");
  return (
    <Library onValueChange={setValue} value={value}>
      <LibraryNavigation aria-label="Settings pages">
        <LibraryNavigationGroup label="Preferences">
          <LibraryNavigationItem value="general">General</LibraryNavigationItem>
          <LibraryNavigationItem value="appearance">Appearance</LibraryNavigationItem>
        </LibraryNavigationGroup>
      </LibraryNavigation>
      <LibrarySeparator />
      <LibraryContent>
        <LibraryPage hidden={value !== "general"} value="general">
          General settings content
        </LibraryPage>
        <LibraryPage forceMount hidden={value !== "appearance"} value="appearance">
          <PersistentPageContent />
        </LibraryPage>
      </LibraryContent>
    </Library>
  );
}

function PersistentPageContent() {
  const [value, setValue] = useState(0);

  return (
    <button onClick={() => setValue((current) => current + 1)} type="button">
      Appearance visits: {value}
    </button>
  );
}

describe("Library", () => {
  it("supports grouped, controlled tab navigation and independent content pages", async () => {
    const user = userEvent.setup();
    render(<ControlledLibrary />);

    const tablist = within(screen.getByRole("tablist", { name: "Settings pages" }));
    const tabs = tablist.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(["General", "Appearance"]);
    expect(screen.getByText("General settings content")).toBeVisible();
    expect(
      screen.getByRole("button", { hidden: true, name: "Appearance visits: 0" }),
    ).not.toBeVisible();

    tabs[0]?.focus();
    await user.keyboard("{ArrowDown}");

    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Appearance visits: 0" })).toBeVisible();
  });

  it("keeps force-mounted page state when switching tabs", async () => {
    const user = userEvent.setup();
    render(<ControlledLibrary />);

    const tablist = within(screen.getByRole("tablist", { name: "Settings pages" }));
    const appearanceTab = tablist.getByRole("tab", { name: "Appearance" });
    await user.click(appearanceTab);
    await user.click(screen.getByRole("button", { name: "Appearance visits: 0" }));
    await user.click(tablist.getByRole("tab", { name: "General" }));
    await user.click(appearanceTab);

    expect(screen.getByRole("button", { name: "Appearance visits: 1" })).toBeVisible();
  });
});
