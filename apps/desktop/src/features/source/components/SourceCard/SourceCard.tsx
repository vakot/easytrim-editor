import { cva } from "class-variance-authority";
import { memo, type ReactNode, useMemo } from "react";

import { Card } from "@/components/ui/card";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { navigateToEditingInstance } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
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
import {
  createSelectSourceCardActive,
  createSelectSourceCardStatus,
} from "./lib/source-card-selectors";

interface SourceCardProps {
  children: ReactNode;
  className?: string;
  source: EditingInstance;
}

const sourceCardVariants = cva("group/source-card cursor-pointer border ring-0", {
  variants: {
    variant: {
      default: "border-foreground/10",
      destructive: "border-destructive/45",
      success: "border-success/45",
      warning: "border-warning/45",
      active: "border-primary/45",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const SourceCard = memo(function SourceCard({ children, className, source }: SourceCardProps) {
  const dispatch = useAppDispatch();
  const selectActive = useMemo(() => createSelectSourceCardActive(source.id), [source.id]);
  const selectStatus = useMemo(() => createSelectSourceCardStatus(source.id), [source.id]);
  const active = useAppSelector(selectActive);
  const sourceStatus = useAppSelector(selectStatus);
  const { displayName } = source.snapshot.source;
  const status = getSourceCardStatus(source, active, sourceStatus);
  const variant = getSourceCardVariant(status, active);

  return (
    <SourceCardContext.Provider value={source}>
      <SourceCardContextMenu>
        <Card
          aria-checked={active}
          aria-label={displayName}
          className={cn(sourceCardVariants({ variant }), className)}
          data-active={active ? "true" : "false"}
          data-source-id={source.id}
          hoverable
          onClick={() => void dispatch(navigateToEditingInstance(source.id))}
          // TODO: on button confirm (selected by Tab and Enter should also act as onClick)
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
