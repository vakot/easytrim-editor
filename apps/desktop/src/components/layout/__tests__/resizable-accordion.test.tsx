import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resizeMocks = vi.hoisted(() => ({
  panels: new Map<
    string,
    {
      defaultSize?: number | string;
      disabled?: boolean;
      maxSize?: number | string;
      minSize?: number | string;
    }
  >(),
  separators: new Map<string, { disabled?: boolean }>(),
}));

vi.mock("react-resizable-panels", () => ({
  Group: ({ children, id }: { children: ReactNode; id: string }) => (
    <div data-testid={id}>{children}</div>
  ),
  Panel: ({
    children,
    id,
    defaultSize,
    disabled,
    maxSize,
    minSize,
    ...props
  }: {
    children?: ReactNode;
    id: string;
    defaultSize?: number | string;
    disabled?: boolean;
    maxSize?: number | string;
    minSize?: number | string;
  }) => {
    resizeMocks.panels.set(String(id), { defaultSize, disabled, maxSize, minSize });
    return (
      <section {...props} data-testid={`panel-${id}`}>
        {children}
      </section>
    );
  },
  Separator: ({ id, disabled }: { id: string; disabled?: boolean }) => {
    resizeMocks.separators.set(String(id), { disabled });
    return (
      <div
        data-testid={`separator-${id}`}
        role={disabled ? undefined : "separator"}
        aria-hidden={disabled}
      />
    );
  },
}));

import { PaneView, PaneViewContent, PaneViewItem, PaneViewTrigger } from "./resizable-accordion";

interface FixtureProps {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

function Fixture({ value, defaultValue, onValueChange }: FixtureProps) {
  return (
    <PaneView
      id="test-accordion"
      aria-label="Test sections"
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <PaneViewItem id="media" defaultSize="33%" minSize={140}>
        <PaneViewTrigger>Media details</PaneViewTrigger>
        <PaneViewContent className="content-boundary">
          {Array.from({ length: 30 }, (_, index) => (
            <button key={index}>Media row {index + 1}</button>
          ))}
        </PaneViewContent>
      </PaneViewItem>
      <PaneViewItem id="imported" defaultSize="33%">
        <PaneViewTrigger>Imported queue</PaneViewTrigger>
        <PaneViewContent>Imported content</PaneViewContent>
      </PaneViewItem>
      <PaneViewItem id="export" defaultSize="33%" maxSize="70%">
        <PaneViewTrigger>Export queue</PaneViewTrigger>
        <PaneViewContent>Export content</PaneViewContent>
      </PaneViewItem>
    </PaneView>
  );
}

beforeEach(() => {
  resizeMocks.panels.clear();
  resizeMocks.separators.clear();
});

describe("PaneView", () => {
  it("uses its uncontrolled default value and configured open constraints", () => {
    render(<Fixture defaultValue={["media", "imported"]} />);

    expect(screen.getByRole("button", { name: "Media details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Imported queue" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Export queue" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(resizeMocks.panels.get("media")).toEqual({
      defaultSize: "33%",
      disabled: false,
      maxSize: undefined,
      minSize: 140,
    });
    expect(resizeMocks.panels.get("export")).toEqual({
      defaultSize: "33%",
      disabled: true,
      maxSize: 32,
      minSize: 32,
    });
  });

  it("toggles only the selected item and permits every item to be collapsed", async () => {
    const user = userEvent.setup();
    render(<Fixture defaultValue={["media", "imported", "export"]} />);

    await user.click(screen.getByRole("button", { name: "Export queue" }));
    expect(screen.getByRole("button", { name: "Media details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Imported queue" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Export queue" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Imported queue" }));
    await user.click(screen.getByRole("button", { name: "Media details" }));

    for (const trigger of screen.getAllByRole("button")) {
      if (trigger.textContent?.includes("row")) continue;
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("flexes the internal spacer only while all user items are collapsed", async () => {
    const user = userEvent.setup();
    render(<Fixture defaultValue={[]} />);

    expect(resizeMocks.panels.get("test-accordion-spacer")).toEqual({
      defaultSize: 0,
      disabled: false,
      maxSize: undefined,
      minSize: 0,
    });
    expect(screen.getByTestId("panel-test-accordion-spacer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(resizeMocks.separators.get("test-accordion-separator-1")).toEqual({
      disabled: true,
    });

    await user.click(screen.getByRole("button", { name: "Imported queue" }));

    expect(screen.getByRole("button", { name: "Imported queue" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(resizeMocks.panels.get("imported")).toMatchObject({ disabled: false, minSize: 120 });
    expect(resizeMocks.panels.get("test-accordion-spacer")).toEqual({
      defaultSize: 0,
      disabled: true,
      maxSize: 0,
      minSize: 0,
    });
  });

  it("reports controlled changes without changing state until the value prop changes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<Fixture value={["media"]} onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Export queue" }));

    expect(onValueChange).toHaveBeenLastCalledWith(["media", "export"]);
    expect(screen.getByRole("button", { name: "Media details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Export queue" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    rerender(<Fixture value={["export"]} onValueChange={onValueChange} />);

    expect(screen.getByRole("button", { name: "Media details" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Export queue" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Export queue" }));
    expect(onValueChange).toHaveBeenLastCalledWith([]);
  });

  it("keeps disclosure state independent from separator resize events", () => {
    render(<Fixture defaultValue={["media", "imported"]} />);
    const separator = screen.getAllByRole("separator")[0];
    if (!separator) throw new Error("Expected an enabled separator");

    fireEvent.pointerDown(separator, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(separator, { clientY: 180, pointerId: 1 });

    expect(screen.getByRole("button", { name: "Media details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Imported queue" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Export queue" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("associates triggers with hidden regions and keeps scrolling inside each content body", () => {
    render(<Fixture defaultValue={["media"]} />);

    const mediaTrigger = screen.getByRole("button", { name: "Media details" });
    const mediaContent = screen.getByRole("region", { name: "Media details" });
    expect(mediaTrigger).toHaveAttribute("aria-controls", mediaContent.id);
    expect(mediaContent).toHaveAttribute("aria-labelledby", mediaTrigger.id);
    expect(mediaContent).toHaveClass("min-h-0", "flex-1", "content-boundary");
    expect(mediaContent.querySelector('[data-slot="scroll-area-viewport"]')).not.toBeNull();

    const importedContent = document.querySelector<HTMLElement>(
      '[data-slot="resizable-accordion-content"][data-state="closed"]',
    );
    expect(importedContent).toHaveAttribute("hidden");
    expect(screen.queryByRole("region", { name: "Imported queue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Media row 1" })).toBeInTheDocument();
  });
});
