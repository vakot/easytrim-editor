import { cva } from "class-variance-authority";
import { memo, type ReactNode } from "react";

import { Card } from "@/components/ui/card";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { navigateToEditingInstance } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstanceListEntry } from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";

import { SourceCardActions } from "./components/SourceCardActions";
import { SourceCardContextMenu } from "./components/SourceCardContextMenu";
import { SourceCardDescription } from "./components/SourceCardDescription";
import { SourceCardMetadata } from "./components/SourceCardMetadata";
import { SourceCardStatusBadge } from "./components/SourceCardStatusBadge";
import { SourceCardThumbnail } from "./components/SourceCardThumbnail";
import { SourceCardTitle } from "./components/SourceCardTitle";
import { SourceCardContext } from "./contexts/SourceCardContext";
import { getSourceCardStatus, getSourceCardVariant } from "./lib/source-card.utils";
import type { SourceCardSource } from "./types";

interface SourceCardProps {
  children: ReactNode;
  className?: string;
  source: SourceCardSource;
}

const sourceCardVariants = cva("group/source-card cursor-pointer border-0 ring-0", {
  variants: {
    variant: {
      default: "bg-transparent",
      destructive: "bg-destructive/5",
      success: "bg-success/5",
      warning: "bg-warning/5",
      active: "bg-primary/10",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const SourceCard = memo(function SourceCard({ children, className, source }: SourceCardProps) {
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourceEntry = toSourceListEntry(source);

  const active = sourceEntry.id === activeInstanceId;
  const { displayName } = sourceEntry;
  const status = getSourceCardStatus(sourceEntry);
  const variant = getSourceCardVariant(status, active);

  return (
    <SourceCardContext.Provider value={sourceEntry}>
      <SourceCardContextMenu>
        <Card
          aria-checked={active}
          aria-label={displayName}
          className={cn(sourceCardVariants({ variant }), className)}
          data-active={active ? "true" : "false"}
          data-source-id={sourceEntry.id}
          hoverable
          onClick={() => void dispatch(navigateToEditingInstance(sourceEntry.id))}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            if (event.repeat) return;

            void dispatch(navigateToEditingInstance(sourceEntry.id));
          }}
          role="checkbox"
          tabIndex={0}
          variant={variant}
        >
          {children}
        </Card>
      </SourceCardContextMenu>
    </SourceCardContext.Provider>
  );
});

function toSourceListEntry(source: SourceCardSource): EditingInstanceListEntry {
  if ("sourcePath" in source) return source;
  const sourceRef = source.snapshot.source;
  return {
    displayName: sourceRef.displayName,
    ...(source.media?.durationMicros === undefined
      ? {}
      : { durationMicros: source.media.durationMicros }),
    ...(sourceRef.fileSizeBytes === undefined ? {} : { fileSizeBytes: sourceRef.fileSizeBytes }),
    id: source.id,
    ...(source.importedAtMicros === undefined ? {} : { importedAtMicros: source.importedAtMicros }),
    sourceAvailability: source.sourceAvailability,
    sourcePath: sourceRef.sourcePath,
    ...(sourceRef.updatedAtMicros === undefined
      ? {}
      : { updatedAtMicros: sourceRef.updatedAtMicros }),
  };
}

export {
  SourceCard,
  SourceCardActions,
  SourceCardDescription,
  SourceCardMetadata,
  type SourceCardProps,
  SourceCardStatusBadge,
  SourceCardThumbnail,
  SourceCardTitle,
};
