import "./i18n/config";
import "./styles/globals.css";

import React from "react";
import ReactDOM from "react-dom/client";

import { AppErrorBoundary } from "./app/components/AppErrorBoundary";
import { startSourceMediaRuntime } from "./app/store/integration/source-media-runtime";
import { store } from "./app/store/store";
import { App } from "./App";

const stopSourceMediaRuntime = startSourceMediaRuntime(store.dispatch);
window.addEventListener("unload", stopSourceMediaRuntime, { once: true });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
