import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import type { ImportQueueItem } from "@/app/store/slices/export-slice";
import { type CropRect, FULL_CROP } from "@/domain/crop";
import { cn } from "@/lib/class-names.utils";

import { useImportQueue } from "./hooks/useImportQueue";

export function ImportQueueTabs() {
  const { activeItem, items, open, remove } = useImportQueue();

  return (
    <Tabs className="gap-0" onValueChange={open} value={activeItem?.id ?? ""}>
      <ScrollArea
        className="min-w-0 flex-1 px-0.75 pb-0.5"
        fadeColor="var(--preview-surface)"
        orientation="horizontal"
        scrollbarClassName="data-horizontal:h-1.25"
      >
        <TabsList className="w-max min-w-full justify-baseline rounded-b-none bg-preview-surface pb-0">
          {items.map((item) => (
            <div className="relative flex shrink-0 items-center" key={item.id}>
              <ImportQueueTabsTrigger item={item} />
              <Button
                aria-label={`Close ${item.snapshot.source.displayName}`}
                className="absolute right-0.5"
                onClick={(event) => {
                  event.stopPropagation();
                  remove(item.id);
                }}
                size="icon-2xs"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          ))}
        </TabsList>
      </ScrollArea>
      <Separator className="bg-foreground/10" />
    </Tabs>
  );
}

function ImportQueueTabsTrigger({ item }: { item: ImportQueueItem }) {
  const isChange = isItemSnapshotChanged(item);

  return (
    <TabsTrigger className={cn("h-6 flex-0 pr-6 text-xs", isChange && "italic")} value={item.id}>
      {item.snapshot.source.displayName}
    </TabsTrigger>
  );
}

const isItemSnapshotChanged = (item: ImportQueueItem): boolean => {
  const { media, snapshot } = item;
  const expectedDefault = createDefaultEditorSnapshot(snapshot.source, snapshot.audio.mergeAudio);
  const trimChanged =
    "kind" in snapshot.trim
      ? false
      : media === undefined ||
        snapshot.trim.startMicros !== 0 ||
        snapshot.trim.endMicros !== media.durationMicros;

  return (
    trimChanged ||
    !areCropRectsEqual(snapshot.crop ?? FULL_CROP, expectedDefault.crop ?? FULL_CROP) ||
    snapshot.audio.master.enabled !== expectedDefault.audio.master.enabled ||
    snapshot.audio.master.volumePercent !== expectedDefault.audio.master.volumePercent ||
    snapshot.audio.tracks.some((track) => !track.enabled || track.volumePercent !== 50)
  );
};

function areCropRectsEqual(left: CropRect, right: CropRect): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}
