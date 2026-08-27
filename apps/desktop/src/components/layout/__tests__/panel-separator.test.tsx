import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const handleProps = vi.hoisted(() => ({
  current: null as null | {
    disabled?: boolean;
    disableDoubleClick?: boolean;
  },
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizableHandle: ({
    children,
    disabled,
    disableDoubleClick,
    ...props
  }: {
    children: ReactNode;
    disabled?: boolean;
    disableDoubleClick?: boolean;
  }) => {
    handleProps.current = { disabled, disableDoubleClick };
    return (
      <div role="separator" {...props}>
        {children}
      </div>
    );
  },
}));

import { PanelSeparator } from "../panel-separator";

describe("PanelSeparator", () => {
  it("renders a four-pixel vertical hitbox around a centered one-pixel line", () => {
    render(
      <PanelSeparator id="vertical-separator" label="Resize columns" orientation="vertical" />,
    );

    const separator = screen.getByRole("separator", { name: "Resize columns" });
    expect(separator).toHaveClass("w-1", "bg-transparent", "after:hidden");
    expect(separator.querySelector('[data-slot="panel-separator-line"]')).toHaveClass(
      "w-px",
      "left-1/2",
    );
    expect(separator.querySelector('[data-slot="panel-separator-marker"]')).toHaveClass("flex-col");
  });

  it("renders a four-pixel horizontal hitbox and horizontal marker", () => {
    render(
      <PanelSeparator id="horizontal-separator" label="Resize rows" orientation="horizontal" />,
    );

    const separator = screen.getByRole("separator", { name: "Resize rows" });
    expect(separator).toHaveClass(
      "h-1",
      "w-full",
      "aria-[orientation=horizontal]:h-1",
      "[&[aria-orientation=horizontal]>div]:rotate-0",
    );
    expect(separator.querySelector('[data-slot="panel-separator-line"]')).toHaveClass(
      "h-px",
      "top-1/2",
    );
    expect(separator.querySelector('[data-slot="panel-separator-marker"]')).toHaveClass("flex-row");
  });

  it("keeps the active overlay across the full hitbox", () => {
    render(<PanelSeparator id="styled-separator" label="Resize panels" orientation="vertical" />);

    expect(
      screen
        .getByRole("separator", { name: "Resize panels" })
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

  it("forwards disabled and double-click behavior", () => {
    const onDoubleClick = vi.fn();
    const { rerender } = render(
      <PanelSeparator
        id="interactive-separator"
        label="Resize panels"
        orientation="vertical"
        onDoubleClick={onDoubleClick}
      />,
    );

    fireEvent.doubleClick(screen.getByRole("separator", { name: "Resize panels" }));
    expect(onDoubleClick).toHaveBeenCalledOnce();
    expect(handleProps.current).toEqual({ disabled: false, disableDoubleClick: true });

    rerender(
      <PanelSeparator
        id="interactive-separator"
        label="Resize panels"
        orientation="vertical"
        disabled
      />,
    );

    const separator = screen.getByRole("separator", { hidden: true });
    expect(separator).toHaveAttribute("aria-hidden", "true");
    expect(separator).toHaveClass("pointer-events-none", "hidden");
    expect(handleProps.current).toEqual({ disabled: true, disableDoubleClick: false });
  });

  it("hides the optional marker when collapsed", () => {
    render(
      <PanelSeparator
        id="collapsed-separator"
        label="Resize panels"
        orientation="vertical"
        collapsed
      />,
    );

    expect(
      screen
        .getByRole("separator", { name: "Resize panels" })
        .querySelector('[data-slot="panel-separator-marker"]'),
    ).toBeNull();
  });
});
