import { createContext } from "react";

import type { SourceStatus } from "@/app/store/slices/source-slice";

interface SourceCardStatusContextValue {
  active: boolean;
  sourceStatus: SourceStatus;
}

const SourceCardStatusContext = createContext<SourceCardStatusContextValue | null>(null);

export { SourceCardStatusContext };
export type { SourceCardStatusContextValue };
