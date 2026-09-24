import { createContext } from "react";

import type {
  ApplicationCommand,
  ApplicationCommandSurface,
} from "@/app/commands/application-command.types";
import type { ApplicationCommandId } from "@/app/commands/groups";

interface ApplicationCommandsContextValue {
  commands: readonly ApplicationCommand<ApplicationCommandId>[];
  commandsById: Readonly<Record<ApplicationCommandId, ApplicationCommand<ApplicationCommandId>>>;
  executeCommand: (id: ApplicationCommandId, surface: ApplicationCommandSurface) => Promise<void>;
}

const ApplicationCommandsContext = createContext<ApplicationCommandsContextValue | null>(null);

export { ApplicationCommandsContext };
export type { ApplicationCommandsContextValue };
