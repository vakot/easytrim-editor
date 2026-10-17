import { STORAGE_KEYS } from "@/lib/storage.consts";
import { readStoredJson, writeStoredJson } from "@/lib/storage.utils";
import { getEphemeralSessionId } from "@/lib/tauri/profile";

export function isOnboardingCompleted(): boolean {
  const sessionId = getEphemeralSessionId();
  if (!sessionId) return readStoredJson<unknown>(STORAGE_KEYS.onboardingCompleted) === true;
  const completion = readStoredJson<{ completed: boolean; sessionId: string }>(
    STORAGE_KEYS.onboardingCompleted,
    "sessionStorage",
  );

  return completion?.sessionId === sessionId && completion?.completed === true;
}

export function confirmOnboardingCompleted(): void {
  const sessionId = getEphemeralSessionId();
  if (sessionId) {
    writeStoredJson(
      STORAGE_KEYS.onboardingCompleted,
      { sessionId, completed: true },
      "sessionStorage",
    );
  } else {
    writeStoredJson(STORAGE_KEYS.onboardingCompleted, true);
  }
}
