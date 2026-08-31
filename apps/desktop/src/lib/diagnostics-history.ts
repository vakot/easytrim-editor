import {
  listPersistedDiagnosticSessions,
  readPersistedDiagnosticSessionEvents,
} from "./tauri/diagnostics";
import type { DiagnosticEvent } from "./tauri/diagnostics.types";
import { getCurrentDiagnosticSessionId, reportDiagnosticsUnavailable } from "./diagnostics";

interface PersistedDiagnosticsHistorySnapshot {
  events: readonly DiagnosticEvent[];
  loaded: boolean;
  version: number;
}

const listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;
let snapshot: PersistedDiagnosticsHistorySnapshot = {
  events: [],
  loaded: false,
  version: 0,
};

export function getPersistedDiagnosticsHistorySnapshot(): PersistedDiagnosticsHistorySnapshot {
  return snapshot;
}

export function subscribeToPersistedDiagnosticsHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadPersistedDiagnosticsHistory(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = loadHistory();
  return loadPromise;
}

async function loadHistory(): Promise<void> {
  const currentSessionId = getCurrentDiagnosticSessionId();
  try {
    const sessions = (await listPersistedDiagnosticSessions()).filter(
      (session) => session.sessionId !== currentSessionId,
    );

    const history = await Promise.all(
      sessions.map(async (session) => {
        try {
          const events = await readPersistedDiagnosticSessionEvents(session.sessionId);
          return events.filter(
            (event) =>
              event.sessionId === session.sessionId && event.sessionId !== currentSessionId,
          );
        } catch (error: unknown) {
          reportDiagnosticsUnavailable(error);
          return [];
        }
      }),
    );

    publish(history.flat());
  } catch (error: unknown) {
    reportDiagnosticsUnavailable(error);
    publish([]);
  }
}

function publish(events: readonly DiagnosticEvent[]): void {
  snapshot = { events, loaded: true, version: snapshot.version + 1 };
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Activity history observers are non-critical and must not affect diagnostics loading.
    }
  });
}
