import { useCallback, useEffect, useReducer, useState } from "react";

import { initialSessionState, sessionReducer } from "./app/session-state";
import { CapabilityStatus, SourceWorkspace } from "./features/import-source/SourceWorkspace";
import {
  checkMediaCapabilities,
  chooseSource,
  inspectMedia,
  listenForSourceDrag,
  listenForSourceImports,
  normalizeAppError,
  type SourceSelection,
} from "./lib/tauri/media";
import "./App.css";

function App() {
  const [session, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [isChoosingSource, setIsChoosingSource] = useState(false);
  const [isSourceDragActive, setIsSourceDragActive] = useState(false);
  const [dropListenerError, setDropListenerError] = useState<string | null>(null);

  const inspectSource = useCallback((source: SourceSelection) => {
    dispatch({ type: "source-selected", source });
    void inspectMedia(source.sourceId)
      .then((media) => {
        dispatch({ type: "source-ready", sourceId: source.sourceId, media });
      })
      .catch((error: unknown) => {
        dispatch({
          type: "source-failed",
          sourceId: source.sourceId,
          error: normalizeAppError(error),
        });
      });
  }, []);

  useEffect(() => {
    let disposed = false;

    void checkMediaCapabilities()
      .then((capabilities) => {
        if (!disposed) {
          dispatch({ type: "capabilities-ready", capabilities });
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          dispatch({
            type: "capabilities-failed",
            error: normalizeAppError(error),
          });
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listenForSourceImports((event) => {
      if (disposed) {
        return;
      }
      setIsSourceDragActive(false);
      setDropListenerError(null);
      if (event.status === "selected") {
        inspectSource(event.source);
      } else {
        dispatch({ type: "source-failed", error: event.error });
      }
    })
      .then((stopListening) => {
        if (disposed) {
          stopListening();
        } else {
          unlisten = stopListening;
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setDropListenerError(normalizeAppError(error).message);
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [inspectSource]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listenForSourceDrag((event) => {
      if (!disposed) {
        setIsSourceDragActive(event.active);
      }
    })
      .then((stopListening) => {
        if (disposed) {
          stopListening();
        } else {
          unlisten = stopListening;
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setDropListenerError(normalizeAppError(error).message);
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  async function handleChooseSource() {
    if (isChoosingSource) {
      return;
    }

    setIsChoosingSource(true);
    try {
      const source = await chooseSource();
      if (source) {
        inspectSource(source);
      }
    } catch (error: unknown) {
      dispatch({ type: "source-failed", error: normalizeAppError(error) });
    } finally {
      setIsChoosingSource(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-toolbar" aria-label="Application toolbar">
        <div className="app-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Easy Cut</span>
        </div>
        <div className="toolbar-actions">
          <CapabilityStatus capabilities={session.capabilities} />
          <button
            className="toolbar-button"
            type="button"
            onClick={() => void handleChooseSource()}
            disabled={isChoosingSource}
          >
            {isChoosingSource ? "Opening…" : "Open video"}
          </button>
        </div>
      </header>

      {dropListenerError ? (
        <p className="inline-alert" role="alert">
          Drag and drop is unavailable: {dropListenerError}
        </p>
      ) : null}

      <SourceWorkspace
        session={session}
        isChoosingSource={isChoosingSource}
        isSourceDragActive={isSourceDragActive}
        onChooseSource={() => void handleChooseSource()}
      />
    </main>
  );
}

export default App;
