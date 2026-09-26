import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

const commandRuntime = vi.hoisted(() => ({
  commands: {
    "next-source": {
      enabled: true,
      label: "Next source",
      pending: false,
      shortcut: { code: "ArrowRight", key: "ArrowRight", modifier: "alt" },
    },
    "previous-source": {
      enabled: false,
      label: "Previous source",
      pending: false,
      shortcut: { code: "ArrowLeft", key: "ArrowLeft", modifier: "alt" },
    },
  },
  executeCommand: vi.fn(),
}));

vi.mock("@/app/hooks/useApplicationCommands", () => ({
  useApplicationCommand: (id: keyof typeof commandRuntime.commands) => commandRuntime.commands[id],
  useApplicationCommands: () => ({ executeCommand: commandRuntime.executeCommand }),
}));

import { SourceNavigation } from "../SourceNavigation";

describe("SourceNavigation", () => {
  it("navigates between sources and exposes translated boundary labels", async () => {
    const user = userEvent.setup();
    commandRuntime.executeCommand.mockClear();

    render(
      <TooltipProvider delayDuration={0}>
        <SourceNavigation />
      </TooltipProvider>,
    );

    const previousButton = screen.getByRole("button", { name: "Previous source" });
    const nextButton = screen.getByRole("button", { name: "Next source" });
    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    await user.hover(nextButton);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Next source");

    await user.click(nextButton);
    expect(commandRuntime.executeCommand).toHaveBeenCalledWith("next-source", "button");
  });
});
