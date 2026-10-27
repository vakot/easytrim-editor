import "./styles/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { applyPrimaryColor, DEFAULT_PRIMARY_COLOR } from "@easytrim-editor/ui/theme";

import { Landing } from "./Landing";

// The application derives its primary tokens from its primary color; the site uses its default.
applyPrimaryColor(document.documentElement, DEFAULT_PRIMARY_COLOR);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
