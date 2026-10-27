import "./styles/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Landing } from "./Landing";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
