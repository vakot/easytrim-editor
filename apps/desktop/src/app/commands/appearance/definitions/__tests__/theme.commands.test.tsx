import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { selectThemePreference } from "@/app/store/slices/preferences-slice";
import { createAppStore } from "@/app/store/store";

import { useThemeCommands } from "../theme.commands";

function renderThemeCommands() {
  const store = createAppStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  const { result } = renderHook(() => useThemeCommands(), { wrapper });
  const run = (theme: "dark" | "light" | "system") =>
    act(() => result.current.find((command) => command.id === `theme-${theme}`)!.run());

  return { run, store };
}

describe("theme commands", () => {
  let startViewTransition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // A light operating system theme, with view transitions available.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        matches: false,
        media: query,
        removeEventListener: vi.fn(),
      })),
    );
    startViewTransition = vi.fn((update: () => void) => {
      update();
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "startViewTransition");
  });

  it("crossfades a theme change in one view transition", () => {
    const { run, store } = renderThemeCommands();

    run("dark");

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(selectThemePreference(store.getState())).toBe("dark");
  });

  it("applies a choice that looks the same without a transition", () => {
    const { run, store } = renderThemeCommands();

    run("light");

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(selectThemePreference(store.getState())).toBe("light");
  });
});
