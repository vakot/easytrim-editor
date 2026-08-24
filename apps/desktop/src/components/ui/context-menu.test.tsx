import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContextMenu } from "./context-menu";

describe("ContextMenu item layout", () => {
  it("keeps icon and chevron slots fixed across regular and submenu items", () => {
    render(
      <ContextMenu
        label="Menu"
        open
        options={[
          {
            id: "regular",
            label: "Regular",
            hint: "Ctrl+R",
          },
          {
            id: "submenu",
            label: "Submenu",
            submenu: [],
          },
        ]}
      />,
    );

    for (const label of ["Regular", "Submenu"]) {
      const item = screen.getByRole("menuitem", { name: new RegExp(label) });
      expect(item.querySelector('[data-slot="menu-icon"]')).toHaveClass("size-4");
      expect(item.querySelector('[data-slot="menu-chevron"]')).toHaveClass("size-4");
      expect(item.querySelector('[data-slot="menu-name"]')).toHaveTextContent(label);
    }

    const submenu = screen.getByRole("menuitem", { name: "Submenu" });
    expect(submenu.querySelector('[data-slot="menu-chevron"] svg')).toHaveClass(
      "lucide-chevron-right",
      "size-4",
    );
  });
});
