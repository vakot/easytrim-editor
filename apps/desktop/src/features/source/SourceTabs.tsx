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
  orientation?: "vertical" | "horizontal";
}

export function SourceTabs({
  background = "preview-surface",
  orientation = "horizontal",
}: SourceTabsProps) {
  const dispatch = useAppDispatch();
  const { activeInstanceId, closeInstance, readyInstances } = useEditingInstances();

  return (
    <Tabs
      className="gap-0"
      onValueChange={(id) => void dispatch(navigateToEditingInstance(id))}
      orientation={orientation}
      value={activeInstanceId ?? ""}
    >
      <TabsList className={`w-max min-w-full justify-baseline bg-${background} pb-0`}>
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
  const isChange = isItemSnapshotChanged(instance);

  return (
    <TabsTrigger className={cn("h-6 pr-6 text-xs", isChange && "italic")} value={instance.id}>
      <span className="truncate">{instance.snapshot.source.displayName}</span>
    </TabsTrigger>
  );
}

const isItemSnapshotChanged = (instance: EditingInstance): boolean => {
  return false;
  //   const { media, snapshot } = item;
  //   const expectedDefault = createDefaultEditorSnapshot(snapshot.source, snapshot.audio.mergeAudio);
  //   const trimChanged =
  //     "kind" in snapshot.trim
  //       ? false
  //       : media === undefined ||
  //         snapshot.trim.startMicros !== 0 ||
  //         snapshot.trim.endMicros !== media.durationMicros;

  //   return (
  //     trimChanged ||
  //     !areCropRectsEqual(snapshot.crop ?? FULL_CROP, expectedDefault.crop ?? FULL_CROP) ||
  //     snapshot.audio.master.enabled !== expectedDefault.audio.master.enabled ||
  //     snapshot.audio.master.volumePercent !== expectedDefault.audio.master.volumePercent ||
  //     snapshot.audio.tracks.some((track) => !track.enabled || track.volumePercent !== 50)
  //   );
};

// function areCropRectsEqual(left: CropRect, right: CropRect): boolean {
//   return (
//     left.x === right.x &&
//     left.y === right.y &&
//     left.width === right.width &&
//     left.height === right.height
//   );
// }
