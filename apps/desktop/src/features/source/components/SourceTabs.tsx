import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memo, useLayoutEffect, useRef } from "react";

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

function SourceTabs({
  background = "preview-surface",
  className,
  orientation = "horizontal",
}: SourceTabsProps) {
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const entries = useAppSelector(selectEditingInstanceTopologyEntries);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion() === true;

  useLayoutEffect(() => {
    if (orientation !== "horizontal") return;

    activeTabRef.current?.scrollIntoView({
      behavior: reduceMotion ? "instant" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeInstanceId, orientation, reduceMotion]);

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
        <AnimatePresence initial={false} mode="popLayout">
          {entries.map((entry) => (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="shrink-0"
              exit={{ opacity: 0, x: reduceMotion ? 0 : -4 }}
              initial={reduceMotion ? false : { opacity: 0, x: -4 }}
              key={entry.id}
              layout="position"
              transition={{
                layout: { duration: reduceMotion ? 0 : 0.16, ease: "easeOut" },
                opacity: { duration: reduceMotion ? 0 : 0.14 },
                x: { duration: reduceMotion ? 0 : 0.14, ease: "easeOut" },
              }}
            >
              <SourceTabsEntry
                activeTabRef={entry.id === activeInstanceId ? activeTabRef : undefined}
                entry={entry}
                onClose={closeInstance}
                orientation={orientation}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </TabsList>
    </Tabs>
  );
}

const SourceTabsEntry = memo(function SourceTabsEntry({
  activeTabRef,
  entry,
  onClose,
  orientation,
}: {
  activeTabRef?: React.Ref<HTMLButtonElement>;
  entry: { displayName: string; id: string };
  onClose: (id: string) => void;
  orientation: "vertical" | "horizontal";
}) {
  return (
    <div
      className={cn("relative flex shrink-0 items-center", orientation === "vertical" && "w-full")}
    >
      <TabsTrigger className="h-7 pr-7 text-sm" ref={activeTabRef} value={entry.id}>
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

export { SourceTabs };
