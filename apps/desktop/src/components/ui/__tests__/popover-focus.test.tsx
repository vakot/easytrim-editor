import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "@easytrim-editor/ui/button";

import { Input } from "../input";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

describe("Popover focus behavior", () => {
  it("focuses popover content on open and returns focus to the trigger after dismiss", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button>Open popover</Button>
        </PopoverTrigger>
        <PopoverContent>
          <Input aria-label="Popover input" />
        </PopoverContent>
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Open popover" });
    await user.click(trigger);
    const input = screen.getByRole("textbox", { name: "Popover input" });
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
