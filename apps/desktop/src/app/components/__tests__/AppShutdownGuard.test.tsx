import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShutdownGuard } from "../AppShutdownGuard";

const shutdownState = vi.hoisted(() => ({ hasProcessableExports: false }));
const windowActions = vi.hoisted(() => ({
  closeWindow: vi.fn(() => Promise.resolve()),
  listenForWindowCloseRequests: vi.fn(),
  listenForWindowShutdownRequests: vi.fn(),
  unlisten: vi.fn(),
}));

vi.mock("@/app/store/redux-hooks", () => ({
  useAppSelector: () => shutdownState.hasProcessableExports,
}));
vi.mock("@/lib/tauri/window", () => windowActions);

describe("AppShutdownGuard", () => {
  let shouldPreventClose: (() => boolean) | undefined;
  let onCloseRequested: (() => void) | undefined;
  let onShutdownRequested: ((continuation?: () => void | Promise<void>) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    shutdownState.hasProcessableExports = false;
    shouldPreventClose = undefined;
    onCloseRequested = undefined;
    onShutdownRequested = undefined;
    windowActions.listenForWindowShutdownRequests.mockImplementation(
      (shutdownRequested: (continuation?: () => void | Promise<void>) => void) => {
        onShutdownRequested = shutdownRequested;
        return windowActions.unlisten;
      },
    );
    windowActions.listenForWindowCloseRequests.mockImplementation(
      async (preventClose: () => boolean, closeRequested: () => void) => {
        shouldPreventClose = preventClose;
        onCloseRequested = closeRequested;
        return windowActions.unlisten;
      },
    );
  });

  it("clears recovery only after accepting a close request with no active exports", async () => {
    localStorage.setItem("easytrim:workspace-recovery:current", "current");
    localStorage.setItem("easytrim:workspace-recovery:candidate", "candidate");
    render(<AppShutdownGuard />);

    await waitFor(() => expect(shouldPreventClose).toBeDefined());
    expect(shouldPreventClose?.()).toBe(true);
    onCloseRequested?.();
    await waitFor(() => expect(windowActions.closeWindow).toHaveBeenCalledOnce());
    expect(localStorage.getItem("easytrim:workspace-recovery:current")).toBeNull();
    expect(localStorage.getItem("easytrim:workspace-recovery:candidate")).toBeNull();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps recovery when the user cancels a close confirmation", async () => {
    shutdownState.hasProcessableExports = true;
    localStorage.setItem("easytrim:workspace-recovery:current", "current");
    localStorage.setItem("easytrim:workspace-recovery:candidate", "candidate");
    const user = userEvent.setup();
    render(<AppShutdownGuard />);

    onShutdownRequested?.();
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(localStorage.getItem("easytrim:workspace-recovery:current")).toBe("current");
    expect(localStorage.getItem("easytrim:workspace-recovery:candidate")).toBe("candidate");
  });

  it("confirms before closing while exports are queued or rendering", async () => {
    shutdownState.hasProcessableExports = true;
    const user = userEvent.setup();
    render(<AppShutdownGuard />);

    await waitFor(() => expect(shouldPreventClose).toBeDefined());
    expect(shouldPreventClose?.()).toBe(true);
    onShutdownRequested?.();

    await waitFor(() =>
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "The active export queue is still running. Any unsaved editing data will be lost.",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Exit" }));

    await waitFor(() => expect(windowActions.closeWindow).toHaveBeenCalledOnce());
    expect(shouldPreventClose?.()).toBe(false);
  });

  it("runs an update continuation only after confirming the active queue can be lost", async () => {
    shutdownState.hasProcessableExports = true;
    const continueUpdate = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    render(<AppShutdownGuard />);

    await waitFor(() => expect(shouldPreventClose).toBeDefined());
    onShutdownRequested?.(continueUpdate);

    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument());
    expect(continueUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Exit" }));

    await waitFor(() => expect(continueUpdate).toHaveBeenCalledOnce());
    expect(windowActions.closeWindow).not.toHaveBeenCalled();
  });
});
