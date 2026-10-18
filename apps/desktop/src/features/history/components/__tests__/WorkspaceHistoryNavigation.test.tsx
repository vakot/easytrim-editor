import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

const commandRuntime = vi.hoisted(() => ({
  commands: {
    redo: {
      enabled: true,
      icon: null,
      label: "Redo Trim",
      pending: false,
      shortcut: { code: "KeyZ", key: "Z", modifier: "primary", shift: true },
    },
    undo: {
      enabled: false,
      icon: null,
      label: "Undo Crop",
      pending: false,
      shortcut: { code: "KeyZ", key: "Z", modifier: "primary" },
    },
  },
  executeCommand: vi.fn(),
}));

vi.mock("@/app/hooks/useApplicationCommands", () => ({
  useApplicationCommand: (id: keyof typeof commandRuntime.commands) => commandRuntime.commands[id],
  useApplicationCommands: () => ({ executeCommand: commandRuntime.executeCommand }),
}));

import { WorkspaceHistoryNavigation } from "../WorkspaceHistoryNavigation";

describe("WorkspaceHistoryNavigation", () => {
  it("shows state-aware Undo and Redo controls and executes the application commands", async () => {
    const user = userEvent.setup();
    commandRuntime.executeCommand.mockClear();

    render(
      <TooltipProvider delayDuration={0}>
        <WorkspaceHistoryNavigation />
      </TooltipProvider>,
    );

    const undoButton = screen.getByRole("button", { name: "Undo Crop" });
    const redoButton = screen.getByRole("button", { name: "Redo Trim" });
    expect(undoButton).toBeDisabled();
    expect(undoButton).toHaveAttribute("aria-keyshortcuts", "Control+Z");
    expect(redoButton).toBeEnabled();

    await user.hover(redoButton);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Redo Trim");

    await user.click(redoButton);
    expect(commandRuntime.executeCommand).toHaveBeenCalledWith("redo", "button");
  });
});
