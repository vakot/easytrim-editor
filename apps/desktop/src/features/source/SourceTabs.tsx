import { X } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstanceStatusById,
  selectEditingInstanceTopologyEntries,
  selectHasReadyEditingInstances,
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
  const hasReadyInstances = useAppSelector(selectHasReadyEditingInstances);
  const closeInstance = (id: string) => {
    void dispatch(closeActiveEditingInstanceRequested(id));
  };

  if (!hasReadyInstances) return null;

  return (
    <Tabs
      className={cn("gap-0", className)}
      onValueChange={(id) => void dispatch(navigateToEditingInstance(id))}
      orientation={orientation}
      value={activeInstanceId ?? ""}
    >
      <TabsList className={`w-max min-w-full justify-baseline bg-${background} p-0`}>
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
  const status = useAppSelector((state) => selectEditingInstanceStatusById(state, entry.id));
  if (!status) return null;

  return (
    <div
      className={cn("relative flex shrink-0 items-center", orientation === "vertical" && "w-full")}
    >
      <SourceTabsTrigger displayName={entry.displayName} id={entry.id} />
      <Button
        aria-label={`Close ${entry.displayName}`}
        className="absolute right-0.5"
        onClick={() => onClose(entry.id)}
        size="icon-2xs"
        variant="ghost"
      >
        <X />
      </Button>
    </div>
  );
});

function SourceTabsTrigger({ displayName, id }: { displayName: string; id: string }) {
  return (
    <TabsTrigger className="h-6 pr-6 text-xs" value={id}>
      <span className="truncate">{displayName}</span>
    </TabsTrigger>
  );
}
