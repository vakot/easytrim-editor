import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

function ToggleButtonTooltip({ closeOnTriggerClick }: { closeOnTriggerClick?: boolean }) {
  const [enabled, setEnabled] = useState(true);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip closeOnTriggerClick={closeOnTriggerClick} disableHoverableContent>
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

describe("Tooltip", () => {
  it("closes after clicking its trigger by default", async () => {
    const user = userEvent.setup();
    render(<ToggleButtonTooltip />);
    const trigger = screen.getByRole("button", { name: "Toggle" });

    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled");

    await user.click(trigger);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("can stay open and update its content after clicking its trigger", async () => {
    const user = userEvent.setup();
    render(<ToggleButtonTooltip closeOnTriggerClick={false} />);
    const trigger = screen.getByRole("button", { name: "Toggle" });

    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Enabled");

    await user.click(trigger);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Disabled");

    await user.unhover(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
