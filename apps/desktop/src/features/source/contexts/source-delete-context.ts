import { createContext, useContext } from "react";

interface SourceDeleteRequest {
  sourceIds: readonly string[];
  target?: "file" | "folder";
  targetName?: string;
}

interface SourceDeleteContextValue {
  requestSourceDelete: (request: SourceDeleteRequest) => void;
}

const SourceDeleteContext = createContext<SourceDeleteContextValue | null>(null);

function useSourceDelete(): SourceDeleteContextValue {
  const context = useContext(SourceDeleteContext);
  if (!context) throw new Error("useSourceDelete must be used within SourceDeleteProvider");
  return context;
}

export { SourceDeleteContext, useSourceDelete };
export type { SourceDeleteContextValue, SourceDeleteRequest };
