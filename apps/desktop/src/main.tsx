import React from "react";
import ReactDOM from "react-dom/client";

import "./i18n/config";
import "./styles/globals.css";
import App from "./App";
import { AppErrorBoundary } from "./app/components/AppErrorBoundary";
import { startSourceMediaRuntime } from "./app/store/source-media-runtime";
import { store } from "./app/store/store";

const stopSourceMediaRuntime = startSourceMediaRuntime(store.dispatch);
window.addEventListener("unload", stopSourceMediaRuntime, { once: true });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
