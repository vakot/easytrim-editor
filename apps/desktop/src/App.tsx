import { useCallback, useEffect, useReducer, useState } from "react";

import { initialSessionState, sessionReducer } from "./app/session-state";
import { ImportSourcePanel } from "./features/import-source/ImportSourcePanel";
import {
  checkMediaCapabilities,
  chooseSource,
  inspectMedia,
  listenForSourceImports,
  normalizeAppError,
  type SourceSelection,
} from "./lib/tauri/media";
import "./App.css";

function App() {
  const [session, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [isChoosingSource, setIsChoosingSource] = useState(false);
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
      <header className="app-header">
        <div>
          <p className="eyebrow">Local video editor</p>
          <h1>Easy Cut</h1>
        </div>
        <p className="summary">Import a video to inspect its source and prepare a precise cut.</p>
      </header>

      {dropListenerError ? (
        <p className="inline-alert" role="alert">
          Drag and drop is unavailable: {dropListenerError}
        </p>
      ) : null}

      <ImportSourcePanel
        session={session}
        isChoosingSource={isChoosingSource}
        onChooseSource={() => void handleChooseSource()}
      />
    </main>
  );
}

export default App;
