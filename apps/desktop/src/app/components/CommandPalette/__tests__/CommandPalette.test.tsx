import { fireEvent, render, screen } from "@testing-library/react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationCommand } from "@/app/commands/core/application-command.types";

const mocks = vi.hoisted(() => ({
  commands: [] as ApplicationCommand[],
  executeCommand: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/app/hooks/useApplicationCommands", () => ({
  useApplicationCommands: () => ({
    commands: mocks.commands,
    executeCommand: mocks.executeCommand,
  }),
}));

import { CommandPalette } from "../CommandPalette";

function createCommand(
  id: string,
  label: string,
  variant: ApplicationCommand["variant"],
  icon: ApplicationCommand["icon"],
): ApplicationCommand {
  return {
    enabled: true,
    group: { id: "preferences", label: "Preferences" },
    icon,
    id,
    label,
    pending: false,
    searchTerms: [],
    variant,
  };
}

describe("CommandPalette semantic icons", () => {
  beforeEach(() => {
    mocks.commands = [
      createCommand("reset-preferences", "Reset to default", "destructive", <RotateCcw />),
      createCommand("check-for-updates", "Up to date", "success", <CheckCircle2 />),
    ];
    mocks.executeCommand.mockClear();
  });

  it("colors destructive and success icons with the shared menu variant styles", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { code: "KeyH", ctrlKey: true });

    const destructiveItem = await screen.findByRole("option", { name: "Reset to default" });
    const successItem = screen.getByRole("option", { name: "Up to date" });

    expect(destructiveItem).toHaveClass("[&_svg]:text-destructive!");
    expect(successItem).toHaveClass("[&_svg]:text-success!");
  });
});
