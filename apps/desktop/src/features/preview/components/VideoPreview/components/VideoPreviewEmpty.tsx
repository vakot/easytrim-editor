import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import { Kbd, KbdGroup, KbdSeparator } from "@/components/ui/kbd";

import {
  COMMAND_PALETTE_SHORTCUT,
  OPEN_FILE_SHORTCUT,
  OPEN_FOLDER_SHORTCUT,
  SETTINGS_SHORTCUT,
} from "@/app/commands/core/application-command.shortcuts";
import { getShortcutDisplayKeys } from "@/app/commands/core/application-command.utils";
import { SupportLink } from "@/app/components/SupportLink";
import { cn } from "@/lib/class-names.utils";

import styles from "./VideoPreviewEmpty.module.css";

type Shortcut = {
  id: string;
  keys: string[];
  label: string;
  separator?: string;
};

function VideoPreviewEmpty() {
  const { t } = useTranslation();

  const command: Shortcut = {
    id: "command-palette",
    label: t("commands.title"),
    keys: [...getShortcutDisplayKeys(COMMAND_PALETTE_SHORTCUT)],
  };

  const settings: Shortcut = {
    id: "settings-dialog",
    label: t("settings.title"),
    keys: [...getShortcutDisplayKeys(SETTINGS_SHORTCUT)],
  };

  const shortcuts: Shortcut[] = [
    {
      id: "open-file",
      label: t("source.file.openFile"),
      keys: [...getShortcutDisplayKeys(OPEN_FILE_SHORTCUT)],
    },
    {
      id: "open-folder",
      label: t("source.file.openFolder"),
      keys: [...getShortcutDisplayKeys(OPEN_FOLDER_SHORTCUT)],
    },
    {
      id: "play-pause",
      label: t("preview.shortcuts.playPause"),
      keys: ["Space"],
    },
    {
      id: "previous-next-frame",
      label: t("preview.shortcuts.previousNextFrame"),
      keys: ["←", "→"],
      separator: "/",
    },
    {
      id: "mark-in-out",
      label: t("preview.shortcuts.markInOut"),
      keys: ["I", "O"],
      separator: "/",
    },
  ] as const;

  return (
    <section
      aria-label={t("preview.accessibility.empty")}
      className={cn(
        styles.preview,
        "grid size-full min-h-0 place-items-center overflow-hidden px-6 py-8",
      )}
    >
      <div className="grid w-72 max-w-full justify-items-center gap-10">
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none aspect-square w-full opacity-30 grayscale invert-100 dark:opacity-20 dark:invert-0"
          src="/logo-symbol.svg"
        />

        <div className="grid w-full justify-items-center gap-4">
          <div
            aria-label={t("preview.shortcuts.title")}
            className={cn(
              styles.hints,
              "grid w-full gap-2 text-left text-sm text-muted-foreground",
            )}
            role="list"
          >
            {shortcuts.map((shortcut) => (
              <VideoPreviewEmptyShortcut key={shortcut.id} shortcut={shortcut} />
            ))}

            <div className="-mx-2 grid gap-2 rounded-xl border border-dashed p-2">
              <VideoPreviewEmptyShortcut shortcut={settings} />
              <VideoPreviewEmptyShortcut shortcut={command} />
            </div>
          </div>

          <SupportLink />
        </div>
      </div>
    </section>
  );
}

function VideoPreviewEmptyShortcut({
  className,
  shortcut,
}: {
  className?: string;
  shortcut: Shortcut;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)} role="listitem">
      <span className="inline-flex h-5 shrink-0 items-center leading-none">{shortcut.label}</span>
      <span
        aria-hidden="true"
        className="min-w-4 flex-1 border-b border-dotted border-muted-foreground/40"
      />
      <KbdGroup
        aria-label={shortcut.keys.join(shortcut.separator ? ` ${shortcut.separator} ` : " ")}
      >
        {shortcut.keys.map((key, index) => (
          <Fragment key={`${key}-${index}`}>
            {index > 0 && shortcut.separator ? (
              <KbdSeparator>{shortcut.separator}</KbdSeparator>
            ) : null}
            <Kbd>{key}</Kbd>
          </Fragment>
        ))}
      </KbdGroup>
    </div>
  );
}

export { VideoPreviewEmpty };
