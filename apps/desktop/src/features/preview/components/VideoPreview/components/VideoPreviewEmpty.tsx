import { CircleCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup, KbdSeparator } from "@/components/ui/kbd";

import {
  COMMAND_PALETTE_SHORTCUT,
  OPEN_FILE_SHORTCUT,
  OPEN_FOLDER_SHORTCUT,
  SETTINGS_SHORTCUT,
} from "@/app/commands/core/application-command.shortcuts";
import { getShortcutDisplayKeys } from "@/app/commands/core/application-command.utils";
import { SupportLink } from "@/app/components/SupportLink";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";
import { Confetti } from "@/components/confetti";
import {
  AchievementsCategoryContent,
  SplashMessages,
  useHasIncompleteAchievements,
} from "@/features/entertainment";
import { cn } from "@/lib/class-names.utils";
import { STORAGE_KEYS } from "@/lib/storage.consts";
import { readStoredJson, writeStoredJson } from "@/lib/storage.utils";

import styles from "./VideoPreviewEmpty.module.css";

type Shortcut = {
  id: string;
  keys: string[];
  label: string;
  separator?: string;
};

/** How long the completed card lingers before it collapses; the celebration plays in this window. */
const COMPLETION_EXIT_DELAY_SECONDS = 2;

function VideoPreviewEmpty() {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t("preview.accessibility.empty")}
      className={cn(
        styles.preview,
        "grid size-full min-h-0 place-items-center overflow-hidden px-6 py-8",
      )}
    >
      <div className="flex w-full min-w-0 items-center justify-center">
        <VideoPreviewEmptyOnboarding />
        <VideoPreviewEmptyContent />
      </div>
    </section>
  );
}

function VideoPreviewEmptyOnboarding() {
  const { t } = useTranslation();
  const hasIncompleteAchievements = useHasIncompleteAchievements("getting-started");
  const recordsLoaded = useAppSelector((state) => selectAchievementRecords(state) !== null);
  const [completion, setCompletion] = useState<"pending" | "celebrating" | "finished">(() =>
    readStoredJson<unknown>(STORAGE_KEYS.onboardingCompleted) === true ? "finished" : "pending",
  );

  const reduceMotion = useReducedMotion() === true;
  const celebrating = completion === "celebrating";
  const exitDelay = reduceMotion ? 0 : COMPLETION_EXIT_DELAY_SECONDS;

  if (!recordsLoaded || completion === "finished") return null;

  /* Only manual confirmation starts the celebration and collapses the reserved card width. */
  return (
    <motion.div
      animate={{ width: celebrating ? 0 : "29rem" }}
      className={cn(styles.achievements, "min-w-0 shrink-0 overflow-hidden")}
      initial={false}
      onAnimationComplete={() => {
        if (celebrating) setCompletion("finished");
      }}
      transition={{
        delay: celebrating ? exitDelay : 0,
        duration: reduceMotion ? 0 : 1,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <motion.div
        animate={{ opacity: celebrating ? 0 : 1, x: celebrating && !reduceMotion ? "-0.75rem" : 0 }}
        className="relative w-104 shrink-0"
        initial={false}
        transition={{ delay: celebrating ? exitDelay : 0, duration: reduceMotion ? 0 : 0.16 }}
      >
        <AchievementsCategoryContent category="getting-started" compact presentation="onboarding" />
        {!hasIncompleteAchievements ? (
          <Button
            className="mt-3 w-full"
            disabled={celebrating}
            onClick={() => {
              writeStoredJson(STORAGE_KEYS.onboardingCompleted, true);
              setCompletion("celebrating");
            }}
          >
            {t("achievements.onboarding.confirmCompletion")}
          </Button>
        ) : null}
        {celebrating ? <VideoPreviewEmptyOnboardingCompletion /> : null}
      </motion.div>
    </motion.div>
  );
}

/** Completion celebration shown over the card while it waits out the exit delay. */
function VideoPreviewEmptyOnboardingCompletion() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion() === true;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/80 p-2 text-success"
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      role="status"
      transition={{ duration: reduceMotion ? 0 : 0.16 }}
    >
      <CircleCheck aria-hidden="true" className="size-10" />
      <span className="text-sm font-medium">{t("achievements.status.completed")}</span>
      <Confetti active intensity="celebration" mode="border-inside" />
    </motion.div>
  );
}

function VideoPreviewEmptyContent() {
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
    <div className="flex w-72 max-w-full shrink-0 flex-col items-center gap-10">
      <div className="relative">
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none aspect-square w-full opacity-30 grayscale invert-100 dark:opacity-20 dark:invert-0"
          src="/logo-symbol.svg"
        />
        <SplashMessages />
      </div>

      <div className="grid w-full justify-items-center gap-4">
        <div
          aria-label={t("preview.shortcuts.title")}
          className={cn(styles.hints, "grid w-full gap-2 text-left text-sm text-muted-foreground")}
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
