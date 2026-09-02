import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { navigateToEditingInstance } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";

import { useEditingInstances } from "./hooks/useEditingInstances";

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
  const { activeInstanceId, closeInstance, readyInstances } = useEditingInstances();

  if (!readyInstances.length) return null;

  return (
    <Tabs
      className={cn("gap-0", className)}
      onValueChange={(id) => void dispatch(navigateToEditingInstance(id))}
      orientation={orientation}
      value={activeInstanceId ?? ""}
    >
      <TabsList className={`w-max min-w-full justify-baseline bg-${background} p-0 pb-1`}>
        {readyInstances.map((instance) => (
          <div
            className={cn(
              "relative flex shrink-0 items-center",
              orientation === "vertical" && "w-full",
            )}
            key={instance.id}
          >
            <SourceTabsTrigger instance={instance} />
            <Button
              aria-label={`Close ${instance.snapshot.source.displayName}`}
              className="absolute right-0.5"
              onClick={() => closeInstance(instance.id)}
              size="icon-2xs"
              variant="ghost"
            >
              <X />
            </Button>
          </div>
        ))}
      </TabsList>
    </Tabs>
  );
}

function SourceTabsTrigger({ instance }: { instance: EditingInstance }) {
  return (
    <TabsTrigger className="h-6 pr-6 text-xs" value={instance.id}>
      <span className="truncate">{instance.snapshot.source.displayName}</span>
    </TabsTrigger>
  );
}
