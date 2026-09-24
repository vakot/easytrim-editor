import { createContext } from "react";

import type {
  ApplicationCommand,
  ApplicationCommandId,
  ApplicationCommandSurface,
} from "@/app/commands/application-commands";

interface ApplicationCommandsContextValue {
  commands: readonly ApplicationCommand[];
  commandsById: Readonly<Record<ApplicationCommandId, ApplicationCommand>>;
  executeCommand: (id: ApplicationCommandId, surface: ApplicationCommandSurface) => Promise<void>;
}

const ApplicationCommandsContext = createContext<ApplicationCommandsContextValue | null>(null);

export { ApplicationCommandsContext };
export type { ApplicationCommandsContextValue };
