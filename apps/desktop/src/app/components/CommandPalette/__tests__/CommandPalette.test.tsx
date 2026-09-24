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
  options: Pick<ApplicationCommand, "checked" | "keepOpen" | "surfaces"> = {},
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
    ...options,
  };
}

describe("CommandPalette semantic icons", () => {
  beforeEach(() => {
    mocks.commands = [
      createCommand("reset-preferences", "Reset to default", "destructive", <RotateCcw />),
      createCommand("check-for-updates", "Up to date", "success", <CheckCircle2 />, {
        keepOpen: true,
      }),
    ];
    mocks.executeCommand.mockClear();
    mocks.executeCommand.mockReturnValue(Promise.resolve());
  });

  it("colors destructive and success icons with the shared menu variant styles", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { code: "KeyH", ctrlKey: true });

    const destructiveItem = await screen.findByRole("option", { name: "Reset to default" });
    const successItem = screen.getByRole("option", { name: "Up to date" });

    expect(destructiveItem).toHaveClass("[&_svg]:text-destructive!");
    expect(successItem).toHaveClass("[&_svg]:text-success!");
  });

  it("keeps the palette open for Promise actions so their state and label can update", async () => {
    const view = render(<CommandPalette />);
    fireEvent.keyDown(window, { code: "KeyH", ctrlKey: true });

    fireEvent.click(await screen.findByRole("option", { name: "Up to date" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.executeCommand).toHaveBeenCalledWith("check-for-updates", "palette");

    mocks.commands = [
      ...mocks.commands.filter((command) => command.id !== "check-for-updates"),
      createCommand("check-for-updates", "Update", "default", <CheckCircle2 />, {
        keepOpen: true,
      }),
    ];
    view.rerender(<CommandPalette />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Update" })).toBeInTheDocument();
  });

  it("keeps the palette open after checkbox and radio configuration changes", async () => {
    mocks.commands = [
      ...mocks.commands,
      createCommand("preference-loop-playback", "Loop playback", "default", <CheckCircle2 />, {
        checked: false,
      }),
      createCommand("theme-dark", "Dark", "default", <CheckCircle2 />, { checked: true }),
    ];
    render(<CommandPalette />);
    fireEvent.keyDown(window, { code: "KeyH", ctrlKey: true });

    fireEvent.click(await screen.findByRole("option", { name: "Loop playback" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Dark" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.executeCommand).toHaveBeenCalledWith("preference-loop-playback", "palette");
    expect(mocks.executeCommand).toHaveBeenCalledWith("theme-dark", "palette");
  });

  it("closes the palette when keepOpen explicitly overrides a checked command", async () => {
    mocks.commands = [
      createCommand("theme-dark", "Dark", "default", <CheckCircle2 />, {
        checked: true,
        keepOpen: false,
      }),
    ];
    render(<CommandPalette />);
    fireEvent.keyDown(window, { code: "KeyH", ctrlKey: true });

    fireEvent.click(await screen.findByRole("option", { name: "Dark" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the palette after action clicks even when the action returns a Promise", async () => {
    mocks.commands = [createCommand("open-folder", "Open Folder", "default", <CheckCircle2 />)];
    render(<CommandPalette />);
    fireEvent.keyDown(window, { code: "KeyH", ctrlKey: true });

    fireEvent.click(await screen.findByRole("option", { name: "Open Folder" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the palette after synchronous actions", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { code: "KeyH", ctrlKey: true });

    fireEvent.click(await screen.findByRole("option", { name: "Reset to default" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not include menu-only commands in the palette", async () => {
    mocks.commands = [
      createCommand("reset-preferences", "Reset to default", "destructive", <RotateCcw />, {
        surfaces: ["menu"],
      }),
    ];
    render(<CommandPalette />);
    fireEvent.keyDown(window, { code: "KeyH", ctrlKey: true });

    expect(screen.queryByRole("option", { name: "Reset to default" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
