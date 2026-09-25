import { useContext } from "react";

import { SourceCardStatusContext } from "../contexts/SourceCardStatusContext";

function useSourceCardStatusData() {
  const context = useContext(SourceCardStatusContext);

  if (!context) throw new Error("SourceCardStatusBadge must be used within SourceCard");

  return context;
}

export { useSourceCardStatusData };
