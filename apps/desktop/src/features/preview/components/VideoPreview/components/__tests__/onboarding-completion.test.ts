import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { STORAGE_KEYS } from "@/lib/storage.consts";

import { confirmOnboardingCompleted, isOnboardingCompleted } from "../onboarding-completion";

const nativeSession = (value: string) =>
  Object.defineProperty(window, "__EASYTRIM_EPHEMERAL_SESSION_ID__", { configurable: true, value });

const clearNativeSession = () => {
  delete (window as Window & { __EASYTRIM_EPHEMERAL_SESSION_ID__?: string })
    .__EASYTRIM_EPHEMERAL_SESSION_ID__;
};

describe("onboarding completion persistence", () => {
  beforeEach(() => {
    clearNativeSession();
    localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
    sessionStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
  });
  afterEach(clearNativeSession);

  it("keeps normal profile confirmation in localStorage", () => {
    expect(isOnboardingCompleted()).toBe(false);
    confirmOnboardingCompleted();
    expect(isOnboardingCompleted()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.onboardingCompleted)).toBe("true");
    expect(sessionStorage.getItem(STORAGE_KEYS.onboardingCompleted)).toBeNull();
  });

  it("ignores saved confirmation in fresh mode, retains it within the launch, and resets on the next launch", () => {
    localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
    localStorage.setItem("unrelated-preference", "keep");
    sessionStorage.setItem("unrelated-session", "keep");
    nativeSession("first-native-launch");
    expect(isOnboardingCompleted()).toBe(false);
    confirmOnboardingCompleted();
    expect(isOnboardingCompleted()).toBe(true);
    // A WebView reload gets the same native token and existing sessionStorage.
    nativeSession("first-native-launch");
    expect(isOnboardingCompleted()).toBe(true);
    // A new native process has a different token, even if WebView storage was restored.
    nativeSession("second-native-launch");
    expect(isOnboardingCompleted()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.onboardingCompleted)).toBe("true");
    expect(localStorage.getItem("unrelated-preference")).toBe("keep");
    expect(sessionStorage.getItem("unrelated-session")).toBe("keep");
    clearNativeSession();
    expect(isOnboardingCompleted()).toBe(true);
  });
});
