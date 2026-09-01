import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  downloadAndInstall: vi.fn(),
  invoke: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));

import { checkForUpdates } from "../updates";

describe("updates IPC adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    mocks.check.mockResolvedValue({
      downloadAndInstall: mocks.downloadAndInstall,
      version: "2.0.0",
    });
    mocks.downloadAndInstall.mockResolvedValue(undefined);
    mocks.invoke.mockResolvedValue(undefined);
    mocks.relaunch.mockResolvedValue(undefined);
  });

  it("completes the diagnostics session before installing an update", async () => {
    const update = await checkForUpdates();

    await update?.install();

    expect(mocks.invoke).toHaveBeenCalledWith("complete_diagnostics_session");
    expect(mocks.downloadAndInstall).toHaveBeenCalledOnce();
    expect(mocks.invoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.downloadAndInstall.mock.invocationCallOrder[0]!,
    );
  });
});
