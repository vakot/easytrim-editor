import "./i18n/config";
import "./styles/globals.css";

import React from "react";
import ReactDOM from "react-dom/client";

import { AppErrorBoundary } from "./app/components/AppErrorBoundary";
import { startSourceMediaRuntime } from "./app/store/integration/source-media-runtime";
import { store } from "./app/store/store";
import { diagnostics, installGlobalDiagnostics } from "./lib/diagnostics";
import { App } from "./App";

const stopSourceMediaRuntime = startSourceMediaRuntime(store.dispatch);
const stopGlobalDiagnostics = installGlobalDiagnostics();
window.addEventListener(
  "unload",
  () => {
    stopGlobalDiagnostics();
    stopSourceMediaRuntime();
  },
  { once: true },
);

void diagnostics.initialize().finally(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
});
