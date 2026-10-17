/** Native startup provides this immutable token only for ephemeral progress sessions. */
export function getEphemeralSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const sessionId = (window as Window & { __EASYTRIM_EPHEMERAL_SESSION_ID__?: unknown })
    .__EASYTRIM_EPHEMERAL_SESSION_ID__;

  return typeof sessionId === "string" && sessionId.length > 0 ? sessionId : null;
}
