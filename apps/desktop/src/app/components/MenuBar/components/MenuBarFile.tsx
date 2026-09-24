import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

import {
  type ApplicationCommand,
  getShortcutAriaValue,
  getShortcutDisplayKeys,
} from "@/app/commands/application-commands";
import { commandsById, useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { SourceDeleteDialog } from "@/features/source";

function MenuBarFile() {
  const { t } = useTranslation();
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
  const requestDelete = useCallback((sourceId: string) => setDeleteSourceId(sourceId), []);
  const commands = commandsById(useApplicationCommands(requestDelete));

  return (
    <SourceDeleteDialog
      onOpenChange={(open) => {
        if (!open) setDeleteSourceId(null);
      }}
      open={deleteSourceId !== null}
      sourceId={deleteSourceId}
    >
      <MenubarMenu value="file">
        <MenubarTrigger asChild>
          <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
            {t("app.labels.file")}
          </Button>
        </MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <ApplicationCommandMenuItem command={commands["open-file"]} />
            <ApplicationCommandMenuItem command={commands["open-folder"]} />
            <ApplicationCommandMenuItem command={commands["close-file"]} />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <ApplicationCommandMenuItem command={commands["save-lossless-cut"]} />
            <ApplicationCommandMenuItem command={commands["optimized-export"]} />
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <ApplicationCommandMenuItem command={commands["delete-file"]} destructive />
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </SourceDeleteDialog>
  );
}

function ApplicationCommandMenuItem({
  command,
  destructive = false,
}: {
  command: ApplicationCommand;
  destructive?: boolean;
}) {
  return (
    <MenubarItem
      disabled={!command.enabled}
      onSelect={() => command.execute("menu")}
      variant={destructive ? "destructive" : "default"}
    >
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
    </MenubarItem>
  );
}

export { MenuBarFile };
