import { describe, expect, it } from "vitest";

import type { importQueueItem } from "@/app/store/slices/export-slice";

import { getReplacementImportedItem } from "../imported-queue";

const items = [
  { id: "a", status: "imported", origin: "source-import" },
  { id: "b", status: "imported", origin: "source-import" },
  { id: "c", status: "imported", origin: "source-import" },
] as importQueueItem[];

describe("getReplacementImportedItem", () => {
  it("prefers the next item", () => {
    expect(getReplacementImportedItem(items, 1)?.id).toBe("c");
  });

  it("falls back to the previous item", () => {
    expect(getReplacementImportedItem(items.slice(0, 2), 1)?.id).toBe("a");
  });

  it("returns no replacement for an empty remainder", () => {
    expect(getReplacementImportedItem(items.slice(0, 1), 0)).toBeNull();
  });
});
