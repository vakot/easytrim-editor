import { FileVideo2, FolderOpen, Upload } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SearchBar } from "@/components/ui/search-bar";
import { Separator } from "@/components/ui/separator";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstanceTopologyEntries,
} from "@/app/store/slices/editing-instances-slice";
import { chooseSourceRequested } from "@/app/store/thunks/source-media-thunks";
import { cn } from "@/lib/class-names.utils";

import { SourceTreeNodes } from "./components/SourceTreeNodes";
import { filterSourceTreeNodes, getSourceTreeNodes } from "./lib/source-tree.utils";

interface SourceTreeProps {
  className?: string;
  emptyClassName?: string;
}

export function SourceTree({ className, emptyClassName }: SourceTreeProps) {
  const { t } = useTranslation();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const topologyEntries = useAppSelector(selectEditingInstanceTopologyEntries);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const nodes = useMemo(() => getSourceTreeNodes(topologyEntries), [topologyEntries]);
  const filteredNodes = useMemo(
    () => filterSourceTreeNodes(nodes, deferredSearchQuery),
    [deferredSearchQuery, nodes],
  );

  return (
    <div className={cn("flex min-h-full flex-col gap-2", className)}>
      <SearchBar
        aria-label={t("common.labels.search")}
        onValueChange={setSearchQuery}
        placeholder={t("source.messages.searchPlaceholder")}
        value={searchQuery}
      />
      {nodes.length === 0 ? (
        <SourceExplorerEmptyState className={emptyClassName} />
      ) : filteredNodes.length === 0 ? (
        <p className="px-2 py-4 text-center text-xs text-muted-foreground">
          {t("source.messages.noSearchResults")}
        </p>
      ) : (
        <div className="min-h-0 flex-1">
          <SourceTreeNodes
            nodes={filteredNodes}
            searchQuery={deferredSearchQuery}
            value={activeInstanceId ?? ""}
          />
        </div>
      )}
    </div>
  );
}

function SourceExplorerEmptyState({ className }: SourceTreeProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <form
      aria-label={t("source.labels.explorer")}
      className={cn("flex min-h-full w-full items-center justify-center py-8", className)}
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="grid w-full gap-5">
        <div className="grid gap-3">
          <SourceExplorerAction
            description={t("source.messages.openFileDescription")}
            icon={<FileVideo2 aria-hidden="true" />}
            keys={["Ctrl", "O"]}
            label={t("app.actions.openFile")}
            onClick={() =>
              void dispatch(chooseSourceRequested({ id: "explorer.open-file", type: "button" }))
            }
          />
          <SourceExplorerAction
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

        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center">
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
      </div>
    </form>
  );
}

function SourceExplorerAction({
  description,
  icon,
  keys,
  label,
  onClick,
}: {
  description: string;
  icon: React.ReactNode;
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
