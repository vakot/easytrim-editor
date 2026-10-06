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
        <LibraryPage hidden={value !== "appearance"} value="appearance">
          Appearance settings content
        </LibraryPage>
      </LibraryContent>
    </Library>
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
    expect(screen.getByText("Appearance settings content")).not.toBeVisible();

    tabs[0]?.focus();
    await user.keyboard("{ArrowDown}");

    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Appearance settings content")).toBeVisible();
  });
});
