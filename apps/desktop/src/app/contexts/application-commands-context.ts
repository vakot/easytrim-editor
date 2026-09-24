import { createContext } from "react";

import type { ApplicationCommandId } from "@/app/commands";
import type {
  ApplicationCommand,
  ApplicationCommandExecution,
  ApplicationCommandSurface,
} from "@/app/commands/core/application-command.types";

interface ApplicationCommandsContextValue {
  commands: readonly ApplicationCommand<ApplicationCommandId>[];
  commandsById: Readonly<Record<ApplicationCommandId, ApplicationCommand<ApplicationCommandId>>>;
  executeCommand: (
    id: ApplicationCommandId,
    surface: ApplicationCommandSurface,
  ) => ApplicationCommandExecution;
}

const ApplicationCommandsContext = createContext<ApplicationCommandsContextValue | null>(null);

export { ApplicationCommandsContext };
export type { ApplicationCommandsContextValue };
