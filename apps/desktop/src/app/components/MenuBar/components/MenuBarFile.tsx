import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

import { getShortcutAriaValue, getShortcutDisplayKeys } from "@/app/commands/application-commands";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";

function MenuBarFile() {
  const { t } = useTranslation();

  return (
    <MenubarMenu value="file">
      <MenubarTrigger asChild>
        <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
          {t("app.labels.file")}
        </Button>
      </MenubarTrigger>
      <MenubarContent>
        <MenubarGroup>
          <ApplicationCommandMenuItem commandId="open-file" />
          <ApplicationCommandMenuItem commandId="open-folder" />
          <ApplicationCommandMenuItem commandId="close-file" />
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <ApplicationCommandMenuItem commandId="save-lossless-cut" />
          <ApplicationCommandMenuItem commandId="optimized-export" />
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <ApplicationCommandMenuItem commandId="delete-file" />
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}

function ApplicationCommandMenuItem({
  commandId,
}: {
  commandId: Parameters<typeof useApplicationCommand>[0];
}) {
  const command = useApplicationCommand(commandId);
  const { executeCommand } = useApplicationCommands();
  const content = (
    <>
      {command.label}
      {command.shortcut ? (
        <MenubarShortcut aria-label={getShortcutAriaValue(command.shortcut)}>
          <KbdGroup>
            {getShortcutDisplayKeys(command.shortcut).map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        </MenubarShortcut>
      ) : null}
    </>
  );

  if (command.checked !== undefined) {
    return (
      <MenubarCheckboxItem
        aria-busy={command.pending}
        checked={command.checked}
        disabled={!command.enabled || command.pending}
        onSelect={() => void executeCommand(command.id, "menu")}
        variant={command.variant}
      >
        {content}
      </MenubarCheckboxItem>
    );
  }

  return (
    <MenubarItem
      aria-busy={command.pending}
      disabled={!command.enabled || command.pending}
      onSelect={() => void executeCommand(command.id, "menu")}
      variant={command.variant}
    >
      {content}
    </MenubarItem>
  );
}

export { MenuBarFile };
