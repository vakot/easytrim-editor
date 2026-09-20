import { createContext } from "react";

import type { EditingInstance } from "@/domain/editing-instance";

const SourceCardContext = createContext<EditingInstance | null>(null);

export { SourceCardContext };
