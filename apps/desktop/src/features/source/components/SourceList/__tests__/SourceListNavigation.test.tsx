import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@easytrim-editor/ui/tooltip";

const commandRuntime = vi.hoisted(() => ({
  commands: {
    "next-source": {
      enabled: true,
      label: "Next source",
      pending: false,
      shortcut: { code: "BracketRight", key: "]", modifier: "none" },
    },
    "previous-source": {
      enabled: true,
      label: "Previous source",
      pending: false,
      shortcut: { code: "BracketLeft", key: "[", modifier: "none" },
    },
  },
  executeCommand: vi.fn(),
}));

vi.mock("@/app/hooks/useApplicationCommands", () => ({
  useApplicationCommand: (id: keyof typeof commandRuntime.commands) => commandRuntime.commands[id],
  useApplicationCommands: () => ({ executeCommand: commandRuntime.executeCommand }),
}));

import { SourceListNavigation } from "../components/SourceListNavigation";

describe("SourceListNavigation", () => {
  it("shows bracket shortcuts in the previous and next tooltips", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider delayDuration={0}>
        <SourceListNavigation />
      </TooltipProvider>,
    );

    const previousButton = screen.getByRole("button", { name: "Previous source" });
    const nextButton = screen.getByRole("button", { name: "Next source" });
    expect(previousButton).toHaveAttribute("aria-keyshortcuts", "[");
    expect(nextButton).toHaveAttribute("aria-keyshortcuts", "]");

    await user.hover(nextButton);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Next source");
    expect(tooltip.querySelector('[data-slot="kbd"]')).toHaveTextContent("]");
  });
});
