import { createContext, type ReactElement, useContext } from "react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { menuClassNames } from "@/components/ui/menu";
import { Slot } from "@/components/ui/slot";

import {
  type ApplicationCommand,
  type ApplicationCommandId,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
} from "@/app/commands/application-commands";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";

interface ApplicationCommandMenuContextValue {
  command: ApplicationCommand;
  executeCommand: () => Promise<void>;
}

const ApplicationCommandMenuContext = createContext<ApplicationCommandMenuContextValue | null>(
  null,
);

function useApplicationCommandMenuContext() {
  const context = useContext(ApplicationCommandMenuContext);
  if (!context) {
    throw new Error(
      "ApplicationCommandLabel and ApplicationCommandShortcut must be used within ApplicationCommandMenuItem",
    );
  }
  return context;
}

function ApplicationCommandMenuItem({
  children,
  commandId,
}: {
  asChild: true;
  children: ReactElement;
  commandId: ApplicationCommandId;
}) {
  const command = useApplicationCommand(commandId);
  const { executeCommand } = useApplicationCommands();
  const context = {
    command,
    executeCommand: () => executeCommand(command.id, "menu"),
  } satisfies ApplicationCommandMenuContextValue;

  const commandProps = {
    "aria-busy": command.pending || undefined,
    disabled: !command.enabled || command.pending,
    onSelect: () => {
      void context.executeCommand();
    },
    variant: command.variant,
    ...(command.checked === undefined ? {} : { checked: command.checked }),
  };

  return (
    <ApplicationCommandMenuContext.Provider value={context}>
      <Slot {...commandProps}>{children}</Slot>
    </ApplicationCommandMenuContext.Provider>
  );
}

function ApplicationCommandLabel() {
  const { command } = useApplicationCommandMenuContext();
  return <>{command.label}</>;
}

function ApplicationCommandShortcut() {
  const { command } = useApplicationCommandMenuContext();
  if (!command.shortcut) return null;

  return (
    <span aria-label={getShortcutAriaValue(command.shortcut)} className={menuClassNames.shortcut}>
      <KbdGroup>
        {getShortcutDisplayKeys(command.shortcut).map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </KbdGroup>
    </span>
  );
}

export { ApplicationCommandLabel, ApplicationCommandMenuItem, ApplicationCommandShortcut };
