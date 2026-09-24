import { createContext } from "react";

import type { ApplicationCommandId } from "@/app/commands";
import type {
  ApplicationCommand,
  ApplicationCommandSurface,
} from "@/app/commands/core/application-command.types";

interface ApplicationCommandsContextValue {
  commands: readonly ApplicationCommand<ApplicationCommandId>[];
  commandsById: Readonly<Record<ApplicationCommandId, ApplicationCommand<ApplicationCommandId>>>;
  executeCommand: (id: ApplicationCommandId, surface: ApplicationCommandSurface) => Promise<void>;
}

const ApplicationCommandsContext = createContext<ApplicationCommandsContextValue | null>(null);

export { ApplicationCommandsContext };
export type { ApplicationCommandsContextValue };
