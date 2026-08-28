import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppUpdates } from "@/app/hooks/useAppUpdates";

import { AppUpdatesProvider } from "../AppUpdatesProvider";

const availableVersion = "next-version";

const nativeUpdates = vi.hoisted(() => ({
  checkForUpdates: vi.fn(),
  isTauriRuntime: vi.fn(() => true),
}));

vi.mock("@/lib/tauri/updates", () => nativeUpdates);

function UpdateProbe() {
  const updates = useAppUpdates();

  return (
    <div>
      <span data-testid="status">{updates.status}</span>
      <span data-testid="version">{updates.availableVersion ?? ""}</span>
      <button type="button" onClick={() => void updates.checkForUpdates()}>
        Check
      </button>
      <button type="button" onClick={() => void updates.installUpdate()}>
        Install
      </button>
    </div>
  );
}

describe("AppUpdatesProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nativeUpdates.isTauriRuntime.mockReturnValue(true);
  });

  it("checks on mount and installs the available update", async () => {
    const install = vi.fn(() => Promise.resolve());
    nativeUpdates.checkForUpdates.mockResolvedValue({ version: availableVersion, install });
    const user = userEvent.setup();

    render(
      <AppUpdatesProvider>
        <UpdateProbe />
      </AppUpdatesProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("available"));
    expect(screen.getByTestId("version")).toHaveTextContent(availableVersion);
    await user.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => expect(install).toHaveBeenCalledOnce());
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("version")).toHaveTextContent("");
  });

  it("requires the AppUpdatesProvider boundary", () => {
    expect(() => render(<UpdateProbe />)).toThrowError(
      "useAppUpdates must be used within AppUpdatesProvider.",
    );
  });

  it("keeps the up-to-date state after a successful check with no update", async () => {
    nativeUpdates.checkForUpdates.mockResolvedValue(null);

    render(
      <AppUpdatesProvider>
        <UpdateProbe />
      </AppUpdatesProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("up-to-date"));
    expect(screen.getByTestId("version")).toHaveTextContent("");
  });

  it("keeps an error state when update installation fails", async () => {
    const install = vi.fn(() => Promise.reject(new Error("installation failed")));
    nativeUpdates.checkForUpdates.mockResolvedValue({ version: availableVersion, install });
    const user = userEvent.setup();

    render(
      <AppUpdatesProvider>
        <UpdateProbe />
      </AppUpdatesProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("available"));
    await user.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
  });

  it("keeps an error state after an automatic or manual check fails", async () => {
    nativeUpdates.checkForUpdates
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockRejectedValueOnce(new Error("network unavailable"));
    const user = userEvent.setup();

    render(
      <AppUpdatesProvider>
        <UpdateProbe />
      </AppUpdatesProvider>,
    );

    await waitFor(() => expect(nativeUpdates.checkForUpdates).toHaveBeenCalledOnce());
    expect(screen.getByTestId("status")).toHaveTextContent("error");
    await user.click(screen.getByRole("button", { name: "Check" }));

    await waitFor(() => expect(nativeUpdates.checkForUpdates).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("status")).toHaveTextContent("error");
  });
});
