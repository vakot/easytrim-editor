import { describe, expect, it } from "vitest";

import { getQueueFinishCommandId } from "../definitions/queue-finish.commands";

describe("queue finish command ids", () => {
  it.each([
    ["exit", "queue-finish-exit"],
    ["nothing", "queue-finish-nothing"],
    ["systemSleep", "queue-finish-system-sleep"],
    ["systemShutdown", "queue-finish-system-shutdown"],
  ] as const)("maps %s to its command", (action, commandId) => {
    expect(getQueueFinishCommandId(action)).toBe(commandId);
  });
});
