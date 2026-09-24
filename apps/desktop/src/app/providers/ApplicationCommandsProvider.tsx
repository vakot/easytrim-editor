import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import {
  type ApplicationCommand,
  type ApplicationCommandDefinition,
  type ApplicationCommandSurface,
  commandOrigin,
} from "@/app/commands/application-command.types";
import {
  commandsById,
  materializeApplicationCommands,
} from "@/app/commands/application-command.utils";
import { type ApplicationCommandId, useApplicationCommandGroups } from "@/app/commands/groups";
import { ApplicationCommandsContext } from "@/app/contexts/application-commands-context";
import { diagnostics } from "@/lib/diagnostics";

function ApplicationCommandsProvider({ children }: { children: ReactNode }) {
  const groups = useApplicationCommandGroups();
  const [pendingIds, setPendingIds] = useState<ReadonlySet<ApplicationCommandId>>(() => new Set());
  const pendingIdsRef = useRef(new Set<ApplicationCommandId>());
  const definitions = useMemo<readonly ApplicationCommandDefinition<ApplicationCommandId>[]>(
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
      if (!definition || !definition.enabled || pendingIdsRef.current.has(id)) return;

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
    () => materializeApplicationCommands(definitions, pendingIds),
    [definitions, pendingIds],
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
