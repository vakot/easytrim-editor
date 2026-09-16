import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store/store";

import { CompactExportQueueWindow } from "../CompactExportQueueWindow";

const windowActions = vi.hoisted(() => ({
  startWindowDragging: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/tauri/window", () => windowActions);

describe("CompactExportQueueWindow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts native dragging from non-interactive content only", () => {
    render(
      <Provider store={store}>
        <CompactExportQueueWindow onRestore={vi.fn()} />
      </Provider>,
    );

    const compactWindow = screen.getByRole("main", { name: "Export Queue" });
    fireEvent.pointerDown(compactWindow, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
    });
    fireEvent.pointerMove(compactWindow, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(compactWindow, { pointerId: 1 });

    expect(windowActions.startWindowDragging).toHaveBeenCalledOnce();

    const toggle = screen.getByRole("button", { name: "Export Queue" });
    fireEvent.pointerDown(toggle, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 2,
    });
    fireEvent.pointerMove(toggle, { clientX: 20, clientY: 10, pointerId: 2 });

    expect(windowActions.startWindowDragging).toHaveBeenCalledOnce();
  });
});
