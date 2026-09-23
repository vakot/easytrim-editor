import { FileVideo2, FolderCode, FolderOpen, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { chooseSourceRequested } from "@/app/store/thunks/source-media-thunks";
import { cn } from "@/lib/class-names.utils";

import styles from "./SourceListEmpty.module.css";

function SourceListEmpty() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <section
      aria-label={t("source.labels.explorer")}
      className={cn(
        styles.container,
        "flex min-h-full w-full items-center justify-center overflow-hidden py-8",
      )}
    >
      <Empty className="w-full max-w-3xl border-0 p-0">
        <EmptyHeader>
          <EmptyMedia className={styles.hideOnShorterContainer} variant="icon">
            <FolderCode aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("source.messages.emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("source.messages.emptyDescription")}</EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <div className="grid w-full gap-3">
            <SourceListEmptyAction
              description={t("source.messages.openFileDescription")}
              icon={<FileVideo2 aria-hidden="true" />}
              keys={["Ctrl", "O"]}
              label={t("app.actions.openFile")}
              onClick={() =>
                void dispatch(chooseSourceRequested({ id: "explorer.open-file", type: "button" }))
              }
            />
            <SourceListEmptyAction
              description={t("source.messages.openFolderDescription")}
              icon={<FolderOpen aria-hidden="true" />}
              keys={["Ctrl", "K"]}
              label={t("app.actions.openFolder")}
              onClick={() =>
                void dispatch(
                  chooseSourceRequested({ id: "explorer.open-folder", type: "button" }, "folders"),
                )
              }
            />
          </div>

          <div className={cn(styles.hideOnShortContainer, "flex w-full items-center gap-2")}>
            <Separator className="flex-1" />
            <span className="text-muted-foreground">{t("common.labels.or")}</span>
            <Separator className="flex-1" />
          </div>

          <div
            className={cn(
              styles.hideOnShortContainer,
              "grid w-full justify-items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center",
            )}
          >
            <span className="grid size-10 place-items-center rounded-full bg-primary/12 text-primary">
              <Upload aria-hidden="true" className="size-5" />
            </span>
            <strong className="text-sm">{t("source.messages.dropTitle")}</strong>
            <span className="text-xs font-medium text-primary">
              {t("source.messages.extensions")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("source.messages.dropDescription")}
            </span>
          </div>
        </EmptyContent>
      </Empty>
    </section>
  );
}

function SourceListEmptyAction({
  description,
  icon,
  keys,
  label,
  onClick,
}: {
  description: string;
  icon: ReactNode;
  keys: readonly string[];
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{description}</span>
      <Button className="w-full justify-between" onClick={onClick} type="button">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <KbdGroup aria-label={keys.join(" + ")}>
          {keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </KbdGroup>
      </Button>
    </div>
  );
}

export { SourceListEmpty };
