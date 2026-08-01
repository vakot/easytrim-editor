import { fireEvent, render, screen } from "@testing-library/react";
import { Group, Panel } from "react-resizable-panels";
import { describe, expect, it, vi } from "vitest";

import { PaneResizeHandle } from "./PaneResizeHandle";

describe("PaneResizeHandle", () => {
  it("uses the provided reset behavior on double-click", () => {
    const onReset = vi.fn();

    render(
      <Group orientation="vertical">
        <Panel />
        <PaneResizeHandle
          id="test-handle"
          label="Resize panels"
          onReset={onReset}
          orientation="horizontal"
        />
        <Panel />
      </Group>,
    );

    fireEvent.doubleClick(screen.getByRole("separator", { name: "Resize panels" }));

    expect(onReset).toHaveBeenCalledOnce();
  });
});
