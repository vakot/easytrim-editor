import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

function ToggleButtonTooltip({
  defaultOpen,
  preserveOnTrigger = false,
}: {
  defaultOpen?: boolean;
  preserveOnTrigger?: boolean;
}) {
  const [enabled, setEnabled] = useState(true);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip
        defaultOpen={defaultOpen}
        preserveOnTrigger={preserveOnTrigger}
        disableHoverableContent
      >
        <TooltipTrigger asChild>
          <button type="button" onClick={() => setEnabled((current) => !current)}>
            Toggle
          </button>
        </TooltipTrigger>
        <TooltipContent>{enabled ? "Enabled" : "Disabled"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MenuTriggerTooltip() {
  return (
    <TooltipProvider delayDuration={0}>
      <Menu>
        <Tooltip>
          <TooltipTrigger asChild>
            <MenuTrigger asChild>
              <Button type="button">Open menu</Button>
            </MenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Menu controls</TooltipContent>
        </Tooltip>
        <MenuContent>
          <MenuItem>Menu item</MenuItem>
        </MenuContent>
      </Menu>
    </TooltipProvider>
  );
}

describe("Tooltip", () => {
  it("respects its default open state", () => {
    render(<ToggleButtonTooltip defaultOpen />);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Enabled");
  });

  it("closes after clicking its trigger by default", async () => {
    const user = userEvent.setup();
    render(<ToggleButtonTooltip />);
    const trigger = screen.getByRole("button", { name: "Toggle" });

    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled");

    await user.click(trigger);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes by default when its trigger also opens a menu", async () => {
    const user = userEvent.setup();
    render(<MenuTriggerTooltip />);
    const trigger = screen.getByRole("button", { name: "Open menu" });

    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Menu controls");

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Menu item" })).toBeInTheDocument();
  });

  it("preserves and updates the tooltip during a pointer-triggered click", async () => {
    const user = userEvent.setup();
    render(<ToggleButtonTooltip preserveOnTrigger />);
    const trigger = screen.getByRole("button", { name: "Toggle" });

    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled");

    await user.click(trigger);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Disabled");

    await user.unhover(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("preserves and updates the tooltip during keyboard activation", async () => {
    const user = userEvent.setup();
    render(<ToggleButtonTooltip preserveOnTrigger />);
    const trigger = screen.getByRole("button", { name: "Toggle" });

    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled");

    trigger.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("tooltip")).toHaveTextContent("Disabled");

    await user.keyboard(" ");

    expect(screen.getByRole("tooltip")).toHaveTextContent("Enabled");
  });

  it("clears preservation when a pointer interaction does not click", async () => {
    const user = userEvent.setup();
    render(<ToggleButtonTooltip preserveOnTrigger />);
    const trigger = screen.getByRole("button", { name: "Toggle" });

    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled");

    fireEvent.pointerDown(trigger, { button: 2 });
    fireEvent.pointerUp(trigger, { button: 2 });
    fireEvent.pointerLeave(trigger);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
