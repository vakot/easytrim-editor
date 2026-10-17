import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  downloadAndInstall: vi.fn(),
  getIdentifier: vi.fn(),
  invoke: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/app", () => ({ getIdentifier: mocks.getIdentifier }));
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
    mocks.getIdentifier.mockResolvedValue("com.vakot.easytrimeditor");
    mocks.downloadAndInstall.mockResolvedValue(undefined);
    mocks.invoke.mockResolvedValue(undefined);
    mocks.relaunch.mockResolvedValue(undefined);
  });

  it.each([
    "com.vakot.easytrimeditor.dev",
    "com.vakot.easytrimeditor.dev.fresh",
    "com.vakot.easytrimeditor.preview",
  ])("never checks or installs production updates from %s", async (identifier) => {
    mocks.getIdentifier.mockResolvedValue(identifier);
    expect(await checkForUpdates()).toBeNull();
    expect(mocks.check).not.toHaveBeenCalled();
    expect(mocks.downloadAndInstall).not.toHaveBeenCalled();
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
