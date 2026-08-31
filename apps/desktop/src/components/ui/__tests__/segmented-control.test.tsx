import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { SegmentedControl, SegmentedControlItem } from "../segmented-control";

type SegmentedControlItemOverrides = Omit<
  React.ComponentProps<typeof SegmentedControlItem>,
  "value"
>;

function renderControl(
  props: React.ComponentProps<typeof SegmentedControl> = {},
  itemProps: SegmentedControlItemOverrides = {},
) {
  return render(
    <SegmentedControl aria-label="Report type" defaultValue="archive" {...props}>
      <SegmentedControlItem value="archive" {...itemProps}>
        Archive
      </SegmentedControlItem>
      <SegmentedControlItem value="report">Report</SegmentedControlItem>
    </SegmentedControl>,
  );
}

describe("SegmentedControl", () => {
  it("renders a radiogroup with radio semantics", () => {
    renderControl();

    expect(screen.getByRole("radiogroup", { name: "Report type" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Archive" })).toHaveAttribute("aria-checked", "true");
  });

  it("supports controlled selection changes", async () => {
    const user = userEvent.setup();

    function ControlledControl() {
      const [value, setValue] = React.useState("archive");

      return (
        <SegmentedControl aria-label="Report type" onValueChange={setValue} value={value}>
          <SegmentedControlItem value="archive">Archive</SegmentedControlItem>
          <SegmentedControlItem value="report">Report</SegmentedControlItem>
        </SegmentedControl>
      );
    }

    render(<ControlledControl />);
    await user.click(screen.getByRole("radio", { name: "Report" }));

    expect(screen.getByRole("radio", { name: "Report" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Archive" })).toHaveAttribute("aria-checked", "false");
  });

  it("supports uncontrolled selection changes", async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole("radio", { name: "Report" }));

    expect(screen.getByRole("radio", { name: "Report" })).toHaveAttribute("aria-checked", "true");
  });

  it("retains Radix arrow-key navigation", async () => {
    const user = userEvent.setup();
    renderControl();

    const archive = screen.getByRole("radio", { name: "Archive" });
    archive.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Report" })).toHaveFocus();
  });

  it("does not select a disabled item", async () => {
    const user = userEvent.setup();
    render(
      <SegmentedControl aria-label="Report type" defaultValue="archive">
        <SegmentedControlItem value="archive">Archive</SegmentedControlItem>
        <SegmentedControlItem disabled value="report">
          Report
        </SegmentedControlItem>
      </SegmentedControl>,
    );

    const report = screen.getByRole("radio", { name: "Report" });
    expect(report).toBeDisabled();
    await user.click(report);

    expect(screen.getByRole("radio", { name: "Archive" })).toHaveAttribute("aria-checked", "true");
  });

  it("propagates a disabled root to its items", () => {
    renderControl({ disabled: true });

    expect(screen.getAllByRole("radio").every((radio) => radio.hasAttribute("disabled"))).toBe(
      true,
    );
  });

  it("preserves consumer class names on the root and item", () => {
    renderControl({ className: "custom-root" }, { className: "min-w-24" });

    expect(screen.getByRole("radiogroup")).toHaveClass("custom-root");
    expect(screen.getByRole("radio", { name: "Archive" })).toHaveClass("min-w-24");
  });
});
