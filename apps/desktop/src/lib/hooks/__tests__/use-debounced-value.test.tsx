import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "../use-debounced-value";

describe("useDebouncedValue", () => {
  it("updates only after the delay", () => {
    vi.useFakeTimers();

    try {
      const { rerender, result } = renderHook(({ value }) => useDebouncedValue(value, 250), {
        initialProps: { value: "" },
      });

      rerender({ value: "clip" });
      expect(result.current).toBe("");

      act(() => vi.advanceTimersByTime(249));
      expect(result.current).toBe("");

      act(() => vi.advanceTimersByTime(1));
      expect(result.current).toBe("clip");
    } finally {
      vi.useRealTimers();
    }
  });
});
