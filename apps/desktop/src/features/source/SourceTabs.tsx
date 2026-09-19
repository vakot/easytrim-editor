import { X } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstanceTopologyEntries,
} from "@/app/store/slices/editing-instances-slice";
import {
  closeActiveEditingInstanceRequested,
  navigateToEditingInstance,
} from "@/app/store/thunks/source-media-thunks";
import { cn } from "@/lib/class-names.utils";

interface SourceTabsProps {
  background?: "preview-surface" | "card";
  className?: string;
  orientation?: "vertical" | "horizontal";
}

export function SourceTabs({
  background = "preview-surface",
  className,
  orientation = "horizontal",
}: SourceTabsProps) {
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const entries = useAppSelector(selectEditingInstanceTopologyEntries);
  const closeInstance = (id: string) => {
    void dispatch(closeActiveEditingInstanceRequested(id));
  };

  if (entries.length === 0) return null;

  return (
    <Tabs
      className={cn("gap-0", className)}
      onValueChange={(id) => void dispatch(navigateToEditingInstance(id))}
      orientation={orientation}
      value={activeInstanceId ?? ""}
    >
      <TabsList className={`w-max min-w-full justify-baseline gap-0.5 bg-${background} p-0`}>
        {entries.map((entry) => (
          <SourceTabsEntry
            entry={entry}
            key={entry.id}
            onClose={closeInstance}
            orientation={orientation}
          />
        ))}
      </TabsList>
    </Tabs>
  );
}

const SourceTabsEntry = memo(function SourceTabsEntry({
  entry,
  onClose,
  orientation,
}: {
  entry: { displayName: string; id: string };
  onClose: (id: string) => void;
  orientation: "vertical" | "horizontal";
}) {
  return (
    <div
      className={cn("relative flex shrink-0 items-center", orientation === "vertical" && "w-full")}
    >
      <TabsTrigger className="h-7 pr-7 text-sm" value={entry.id}>
        <span className="truncate">{entry.displayName}</span>
      </TabsTrigger>
      <Button
        aria-label={`Close ${entry.displayName}`}
        className="absolute right-0.5"
        data-slot="source-tab-close"
        onClick={() => onClose(entry.id)}
        size="icon-sm"
        variant="ghost"
      >
        <X />
      </Button>
    </div>
  );
});
