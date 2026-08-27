import { fireEvent, render, screen } from "@testing-library/react";
import type { MouseEventHandler } from "react";
import { describe, expect, it, vi } from "vitest";

import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { PanelSeparator } from "../panel-separator";

interface SeparatorFixtureProps {
  orientation: "horizontal" | "vertical";
  disabled?: boolean;
  collapsed?: boolean;
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
}

function SeparatorFixture({
  orientation,
  disabled,
  collapsed,
  onDoubleClick,
}: SeparatorFixtureProps) {
  return (
    <ResizablePanelGroup
      id={`${orientation}-group`}
      orientation={orientation === "vertical" ? "horizontal" : "vertical"}
    >
      <ResizablePanel id={`${orientation}-before`} defaultSize="50%" />
      <PanelSeparator
        id={`${orientation}-separator`}
        label={`Resize ${orientation} panels`}
        orientation={orientation}
        disabled={disabled}
        collapsed={collapsed}
        onDoubleClick={onDoubleClick}
      />
      <ResizablePanel id={`${orientation}-after`} defaultSize="50%" />
    </ResizablePanelGroup>
  );
}

describe("PanelSeparator", () => {
  it("renders a four-pixel vertical hitbox around a centered one-pixel line", () => {
    render(<SeparatorFixture orientation="vertical" />);

    const separator = screen.getByRole("separator", { name: "Resize vertical panels" });
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("data-separator", "inactive");
    expect(separator).toHaveClass("w-1", "bg-transparent", "after:hidden");
    expect(separator.querySelector('[data-slot="panel-separator-line"]')).toHaveClass(
      "w-px",
      "left-1/2",
    );
    expect(separator.querySelector('[data-slot="panel-separator-marker"]')).toHaveClass("flex-col");
  });

  it("renders a four-pixel horizontal hitbox without rotating custom children", () => {
    render(<SeparatorFixture orientation="horizontal" />);

    const separator = screen.getByRole("separator", { name: "Resize horizontal panels" });
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
    expect(separator).toHaveClass(
      "h-1",
      "w-full",
      "aria-[orientation=horizontal]:h-1",
      "[&[aria-orientation=horizontal]>div]:rotate-0",
    );
    expect(separator).not.toHaveClass("[&[aria-orientation=horizontal]>div]:rotate-90");
    expect(separator.querySelector('[data-slot="panel-separator-line"]')).toHaveClass(
      "h-px",
      "top-1/2",
    );
    expect(separator.querySelector('[data-slot="panel-separator-marker"]')).toHaveClass("flex-row");
  });

  it("keeps the active overlay across the full hitbox", () => {
    render(<SeparatorFixture orientation="vertical" />);

    expect(
      screen
        .getByRole("separator", { name: "Resize vertical panels" })
        .querySelector('[data-slot="panel-separator-overlay"]'),
    ).toHaveClass(
      "absolute",
      "inset-0",
      "group-hover:bg-primary/70",
      "group-focus-visible:bg-primary",
      "group-data-[separator=active]:bg-primary",
      "group-data-[separator=drag]:bg-primary",
    );
  });

  it("supports disabled and custom double-click behavior", () => {
    const onDoubleClick = vi.fn();
    const { rerender } = render(
      <SeparatorFixture orientation="vertical" onDoubleClick={onDoubleClick} />,
    );

    fireEvent.doubleClick(screen.getByRole("separator", { name: "Resize vertical panels" }));
    expect(onDoubleClick).toHaveBeenCalledOnce();

    rerender(<SeparatorFixture orientation="vertical" disabled />);

    const separator = screen.getByRole("separator", { hidden: true });
    expect(separator).toHaveAttribute("aria-hidden", "true");
    expect(separator).toHaveAttribute("aria-disabled", "true");
    expect(separator).not.toHaveAttribute("tabindex");
    expect(separator).toHaveClass("pointer-events-none", "hidden");
  });

  it("hides the optional marker when collapsed", () => {
    render(<SeparatorFixture orientation="vertical" collapsed />);

    expect(
      screen
        .getByRole("separator", { name: "Resize vertical panels" })
        .querySelector('[data-slot="panel-separator-marker"]'),
    ).toBeNull();
  });
});
