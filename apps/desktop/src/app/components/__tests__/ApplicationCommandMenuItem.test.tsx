import { fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps, forwardRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationCommand } from "@/app/commands/application-commands";

const mocks = vi.hoisted(() => ({
  command: null as ApplicationCommand | null,
  executeCommand: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/app/hooks/useApplicationCommands", () => ({
  useApplicationCommand: () => mocks.command,
  useApplicationCommands: () => ({
    commandsById: { [mocks.command?.id ?? "open-file"]: mocks.command },
    commands: mocks.command ? [mocks.command] : [],
    executeCommand: mocks.executeCommand,
  }),
}));

import {
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
  ApplicationCommandShortcut,
} from "../ApplicationCommandMenuItem";

interface ProbeItemProps extends ComponentProps<"button"> {
  checked?: boolean;
  onSelect?: () => void;
  variant?: string;
}

const ProbeItem = forwardRef<HTMLButtonElement, ProbeItemProps>(function ProbeItem(
  { checked, onSelect, variant, ...props },
  ref,
) {
  return (
    <button data-checked={checked} data-variant={variant} onClick={onSelect} ref={ref} {...props} />
  );
});

function createCommand(overrides: Partial<ApplicationCommand> = {}): ApplicationCommand {
  return {
    enabled: true,
    id: "delete-file",
    label: "Delete File",
    pending: false,
    searchTerms: [],
    section: { id: "source", label: "Source" },
    shortcut: { code: "KeyD", key: "D", modifier: "control" },
    variant: "destructive",
    ...overrides,
  };
}

function renderItem() {
  return render(
    <ApplicationCommandMenuItem asChild commandId="delete-file">
      <ProbeItem data-inset="true" data-keep-open="true">
        <ApplicationCommandLabel />
        <ApplicationCommandShortcut />
      </ProbeItem>
    </ApplicationCommandMenuItem>,
  );
}

describe("ApplicationCommandMenuItem", () => {
  beforeEach(() => {
    mocks.command = createCommand({ checked: true });
    mocks.executeCommand.mockClear();
  });

  it("composes command metadata and behavior onto an asChild menu item", () => {
    renderItem();

    const item = screen.getByRole("button", { name: /Delete File/ });
    expect(item).toHaveAttribute("data-checked", "true");
    expect(item).toHaveAttribute("data-variant", "destructive");
    expect(item).toHaveAttribute("data-inset", "true");
    expect(item).toHaveAttribute("data-keep-open", "true");
    expect(screen.getByLabelText("Control+D")).toBeInTheDocument();

    fireEvent.click(item);
    expect(mocks.executeCommand).toHaveBeenCalledWith("delete-file", "menu");
  });

  it.each([
    ["disabled", { enabled: false }],
    ["pending", { pending: true }],
  ])("prevents %s commands from executing", (_state, overrides) => {
    mocks.command = createCommand(overrides);
    renderItem();

    const item = screen.getByRole("button", { name: /Delete File/ });
    expect(item).toBeDisabled();
    fireEvent.click(item);
    expect(mocks.executeCommand).not.toHaveBeenCalled();
  });
});
