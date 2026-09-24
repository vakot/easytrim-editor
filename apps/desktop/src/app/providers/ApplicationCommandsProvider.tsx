import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import { type ApplicationCommandId, useApplicationCommandGroups } from "@/app/commands";
import {
  type ApplicationCommand,
  type ApplicationCommandDefinition,
  type ApplicationCommandSurface,
  commandOrigin,
} from "@/app/commands/core/application-command.types";
import {
  commandsById,
  isApplicationCommandAvailableOnSurface,
  materializeApplicationCommands,
} from "@/app/commands/core/application-command.utils";
import { ApplicationCommandsContext } from "@/app/contexts/application-commands-context";
import { diagnostics } from "@/lib/diagnostics";

function ApplicationCommandsProvider({ children }: { children: ReactNode }) {
  const groups = useApplicationCommandGroups();
  const [pendingIds, setPendingIds] = useState<ReadonlySet<ApplicationCommandId>>(() => new Set());
  const pendingIdsRef = useRef(new Set<ApplicationCommandId>());
  const definitions = useMemo(
    () =>
      groups.flatMap(
        (group) => [...group.commands] as ApplicationCommandDefinition<ApplicationCommandId>[],
      ),
    [groups],
  );

  const definitionsById = useMemo(() => commandsById(definitions), [definitions]);

  const executeCommand = useCallback(
    async (id: ApplicationCommandId, surface: ApplicationCommandSurface) => {
      const definition = definitionsById[id];
      if (
        !definition ||
        !isApplicationCommandAvailableOnSurface(definition, surface) ||
        !definition.enabled ||
        pendingIdsRef.current.has(id)
      )
        return;

      pendingIdsRef.current.add(id);
      setPendingIds(new Set(pendingIdsRef.current));

      try {
        const result = definition.run({ surface });
        if (result && typeof result.then === "function") await result;
      } catch (error: unknown) {
        diagnostics.error("application.command.failed", error, {
          data: { commandId: id, surface },
          origin: commandOrigin(id, surface),
        });
      } finally {
        pendingIdsRef.current.delete(id);
        setPendingIds(new Set(pendingIdsRef.current));
      }
    },
    [definitionsById],
  );

  const commands = useMemo<readonly ApplicationCommand<ApplicationCommandId>[]>(
    () => materializeApplicationCommands(groups, pendingIds),
    [groups, pendingIds],
  );

  const runtime = useMemo(
    () => ({
      commands,
      commandsById: commandsById<ApplicationCommandId, ApplicationCommand<ApplicationCommandId>>(
        commands,
      ),
      executeCommand,
    }),
    [commands, executeCommand],
  );

  return (
    <ApplicationCommandsContext.Provider value={runtime}>
      {children}
    </ApplicationCommandsContext.Provider>
  );
}

export { ApplicationCommandsProvider };
