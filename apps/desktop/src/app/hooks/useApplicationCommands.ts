import { useContext } from "react";

import type { ApplicationCommandId } from "@/app/commands";
import { ApplicationCommandsContext } from "@/app/contexts/application-commands-context";

function useApplicationCommands() {
  const context = useContext(ApplicationCommandsContext);
  if (!context) {
    throw new Error("useApplicationCommands must be used within ApplicationCommandsProvider");
  }
  return context;
}

function useApplicationCommand(id: ApplicationCommandId) {
  return useApplicationCommands().commandsById[id];
}

export { useApplicationCommand, useApplicationCommands };
