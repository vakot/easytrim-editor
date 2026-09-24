import "./i18n/config";
import "./styles/globals.css";

import React from "react";
import ReactDOM from "react-dom/client";

import { AppErrorBoundary } from "./app/components/AppErrorBoundary";
import { startSourceMediaRuntime } from "./app/store/integration/source-media-runtime";
import { initializeWorkspaceRecovery } from "./app/store/recovery/workspace-recovery";
import { store } from "./app/store/store";
import {
  diagnostics,
  getCurrentDiagnosticSessionId,
  installGlobalDiagnostics,
  reportDiagnosticsUnavailable,
} from "./lib/diagnostics";
import { App } from "./App";

function renderApplication() {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
}

async function startApplication() {
  try {
    await diagnostics.initialize();
  } catch (error: unknown) {
    reportDiagnosticsUnavailable(error);
  }

  const recovery = diagnostics.getStartupRecovery();
  initializeWorkspaceRecovery(
    store,
    getCurrentDiagnosticSessionId() ?? "unknown-session",
    recovery !== null,
  );

  const stopGlobalDiagnostics = installGlobalDiagnostics();
  const stopSourceMediaRuntime = startSourceMediaRuntime(store.dispatch);
  window.addEventListener(
    "unload",
    () => {
      stopGlobalDiagnostics();
      stopSourceMediaRuntime();
    },
    { once: true },
  );
  renderApplication();
}

void startApplication();
