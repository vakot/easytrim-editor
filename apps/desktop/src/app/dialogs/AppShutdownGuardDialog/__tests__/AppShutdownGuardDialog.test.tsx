import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearWorkspaceRecoveryOnAcceptedShutdown } from "@/app/store/recovery/workspace-recovery";

import { AppShutdownGuardDialog } from "../AppShutdownGuardDialog";

const shutdownState = vi.hoisted(() => ({ hasProcessableExports: false }));
const windowActions = vi.hoisted(() => ({
  completeShutdown: vi.fn(),
  destroyWindow: vi.fn(() => Promise.resolve()),
  listenForWindowCloseRequests: vi.fn(),
  listenForWindowShutdownRequests: vi.fn(),
  preloadDialog: vi.fn(),
  unlisten: vi.fn(),
}));

vi.mock("@/app/store/redux-hooks", () => ({
  useAppSelector: () => shutdownState.hasProcessableExports,
}));
vi.mock("@/lib/tauri/window", () => windowActions);
vi.mock("@/lib/lazy-component", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lazy-component")>();
  const React = await import("react");

  return {
    ...actual,
    lazyWithPreload: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) =>
      Object.assign(React.lazy(loader), { preload: windowActions.preloadDialog }),
  };
});

describe("AppShutdownGuardDialog", () => {
  let onCloseRequested: (() => void) | undefined;
  let onShutdownRequested: ((continuation?: () => void | Promise<void>) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    shutdownState.hasProcessableExports = false;
    windowActions.preloadDialog.mockResolvedValue(undefined);
    onCloseRequested = undefined;
    onShutdownRequested = undefined;
    windowActions.completeShutdown.mockImplementation(
      async (continuation?: () => void | Promise<void>) => {
        await clearWorkspaceRecoveryOnAcceptedShutdown();

        if (continuation) {
          await continuation();
        } else {
          await windowActions.destroyWindow();
        }
      },
    );
    windowActions.listenForWindowShutdownRequests.mockImplementation(
      (shutdownRequested: (continuation?: () => void | Promise<void>) => void) => {
        onShutdownRequested = shutdownRequested;
        return windowActions.unlisten;
      },
    );
    windowActions.listenForWindowCloseRequests.mockImplementation(
      async (closeRequested: () => void) => {
        onCloseRequested = closeRequested;
        return windowActions.unlisten;
      },
    );
  });

  it("clears recovery only after accepting a close request with no active exports", async () => {
    localStorage.setItem("easytrim:workspace-recovery:current", "current");
    localStorage.setItem("easytrim:workspace-recovery:candidate", "candidate");
    render(<AppShutdownGuardDialog />);

    await waitFor(() => expect(onCloseRequested).toBeDefined());
    onCloseRequested?.();
    await waitFor(() => expect(windowActions.destroyWindow).toHaveBeenCalledOnce());
    expect(localStorage.getItem("easytrim:workspace-recovery:current")).toBeNull();
    expect(localStorage.getItem("easytrim:workspace-recovery:candidate")).toBeNull();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps recovery when the user cancels a close confirmation", async () => {
    shutdownState.hasProcessableExports = true;
    localStorage.setItem("easytrim:workspace-recovery:current", "current");
    localStorage.setItem("easytrim:workspace-recovery:candidate", "candidate");
    const user = userEvent.setup();
    render(<AppShutdownGuardDialog />);

    onShutdownRequested?.();
    await user.click(await screen.findByRole("button", { name: "Back" }));

    expect(localStorage.getItem("easytrim:workspace-recovery:current")).toBe("current");
    expect(localStorage.getItem("easytrim:workspace-recovery:candidate")).toBe("candidate");
  });

  it("confirms before closing while exports are queued or rendering", async () => {
    shutdownState.hasProcessableExports = true;
    const user = userEvent.setup();
    render(<AppShutdownGuardDialog />);

    await waitFor(() => expect(onCloseRequested).toBeDefined());
    onShutdownRequested?.();

    await waitFor(() =>
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "The active export queue is still running. Any unsaved editing data will be lost",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Exit" }));

    await waitFor(() => expect(windowActions.destroyWindow).toHaveBeenCalledOnce());
  });

  it("shows shutdown errors inside the open confirmation dialog", async () => {
    shutdownState.hasProcessableExports = true;
    windowActions.completeShutdown.mockRejectedValueOnce(new Error("Window could not close"));
    const user = userEvent.setup();
    render(<AppShutdownGuardDialog />);

    onShutdownRequested?.();
    await user.click(await screen.findByRole("button", { name: "Exit" }));

    expect(await screen.findByText("Window could not close")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("runs an update continuation only after confirming the active queue can be lost", async () => {
    shutdownState.hasProcessableExports = true;
    const continueUpdate = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    render(<AppShutdownGuardDialog />);

    await waitFor(() => expect(onCloseRequested).toBeDefined());
    onShutdownRequested?.(continueUpdate);

    await screen.findByRole("alertdialog");
    expect(continueUpdate).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Exit" }));

    await waitFor(() => expect(continueUpdate).toHaveBeenCalledOnce());
    expect(windowActions.destroyWindow).not.toHaveBeenCalled();
  });

  it("uses the latest shutdown request received while dialog content is preloading", async () => {
    shutdownState.hasProcessableExports = true;
    let finishPreload!: () => void;
    windowActions.preloadDialog.mockReturnValue(
      new Promise<void>((resolve) => {
        finishPreload = resolve;
      }),
    );
    const closeContinuation = vi.fn(() => Promise.resolve());
    const updateContinuation = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    render(<AppShutdownGuardDialog />);

    await waitFor(() => expect(onShutdownRequested).toBeDefined());
    onShutdownRequested?.(closeContinuation);
    onShutdownRequested?.(updateContinuation);

    expect(windowActions.preloadDialog).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    finishPreload();
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Exit" }));

    await waitFor(() => expect(updateContinuation).toHaveBeenCalledOnce());
    expect(closeContinuation).not.toHaveBeenCalled();
  });
});
