import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "@easytrim-editor/ui/button";

import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "../dialog";
import { Input } from "../input";

describe("Dialog focus behavior", () => {
  it("focuses dialog content when opened and restores the trigger on close", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
          <Input aria-label="Dialog input" />
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    expect(screen.getByRole("textbox", { name: "Dialog input" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
