import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import { availableQueueFinishActions, performQueueFinishAction } from "../queue";

describe("queue IPC adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps only known native finish actions", async () => {
    mocks.invoke.mockResolvedValue(["exit", "systemSleep", "unsupported", "nothing"]);

    await expect(availableQueueFinishActions()).resolves.toEqual([
      "exit",
      "systemSleep",
      "nothing",
    ]);
    expect(mocks.invoke).toHaveBeenCalledWith("available_queue_finish_actions");
  });

  it("sends the selected finish action through the narrow command", async () => {
    mocks.invoke.mockResolvedValue(undefined);

    await performQueueFinishAction("systemShutdown");

    expect(mocks.invoke).toHaveBeenCalledWith("perform_queue_finish_action", {
      action: "systemShutdown",
    });
  });
});
