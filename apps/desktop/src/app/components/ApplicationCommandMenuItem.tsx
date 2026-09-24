import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { menuClassNames } from "@/components/ui/menu";
import { Slot } from "@/components/ui/slot";

import type { ApplicationCommand } from "@/app/commands/application-command.types";
import {
  getShortcutAriaValue,
  getShortcutDisplayKeys,
} from "@/app/commands/application-command.utils";
import type { ApplicationCommandId } from "@/app/commands/groups";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { cn } from "@/lib/class-names.utils";

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
      "ApplicationCommand menu metadata components must be used within ApplicationCommandMenuItem",
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

function ApplicationCommandLabel({ children }: { children?: ReactNode }) {
  const { command } = useApplicationCommandMenuContext();
  return <>{children ?? command.label}</>;
}

function ApplicationCommandIcon({
  className,
  command,
}: {
  className?: string;
  command?: ApplicationCommand;
}) {
  const context = useContext(ApplicationCommandMenuContext);
  const resolvedCommand = command ?? context?.command;
  if (!resolvedCommand) {
    throw new Error(
      "ApplicationCommandIcon must be used with a command or within ApplicationCommandMenuItem",
    );
  }
  if (!className || !isValidElement<{ className?: string }>(resolvedCommand.icon)) {
    return <>{resolvedCommand.icon}</>;
  }

  return (
    <>
      {cloneElement(resolvedCommand.icon, {
        className: cn(resolvedCommand.icon.props.className, className),
      })}
    </>
  );
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

export {
  ApplicationCommandIcon,
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
  ApplicationCommandShortcut,
};
