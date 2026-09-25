import { createContext } from "react";

import type { EditingInstanceListEntry } from "@/domain/editing-instance";

const SourceCardContext = createContext<EditingInstanceListEntry | null>(null);

export { SourceCardContext };
