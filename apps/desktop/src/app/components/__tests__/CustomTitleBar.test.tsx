import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomTitleBar } from "../CustomTitleBar";

const windowActions = vi.hoisted(() => ({
  closeWindow: vi.fn(() => Promise.resolve()),
  isWindowMaximized: vi.fn(() => Promise.resolve(false)),
  minimizeWindow: vi.fn(() => Promise.resolve()),
  startWindowDragging: vi.fn(() => Promise.resolve()),
  toggleWindowMaximize: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/tauri/window", () => windowActions);

describe("CustomTitleBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    windowActions.isWindowMaximized.mockResolvedValue(false);
  });

  it("shows the app logo and accessible window controls", () => {
    render(<CustomTitleBar onLogoClick={vi.fn()} />);

    expect(screen.getByRole("banner", { name: "Window title bar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EasyTrim Editor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maximize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("delegates dragging and window controls to the native adapter", async () => {
    render(<CustomTitleBar onLogoClick={vi.fn()} />);

    const dragRegion = screen.getByRole("banner").querySelector("[data-tauri-drag-region]");
    if (!dragRegion) throw new Error("Expected title bar drag region");
    fireEvent.mouseDown(dragRegion, { button: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    fireEvent.click(screen.getByRole("button", { name: "Maximize" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(windowActions.startWindowDragging).toHaveBeenCalledOnce();
      expect(windowActions.minimizeWindow).toHaveBeenCalledOnce();
      expect(windowActions.toggleWindowMaximize).toHaveBeenCalledOnce();
      expect(windowActions.closeWindow).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    });
  });
});
