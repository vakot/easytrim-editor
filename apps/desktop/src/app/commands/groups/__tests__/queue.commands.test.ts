import { describe, expect, it } from "vitest";

import { getQueueFinishCommandId } from "../queue.commands";

describe("queue finish command mapping", () => {
  it.each([
    ["exit", "queue-finish-exit"],
    ["nothing", "queue-finish-nothing"],
    ["systemSleep", "queue-finish-system-sleep"],
    ["systemShutdown", "queue-finish-system-shutdown"],
  ] as const)("maps %s to its registered command id", (action, commandId) => {
    expect(getQueueFinishCommandId(action)).toBe(commandId);
  });
});
