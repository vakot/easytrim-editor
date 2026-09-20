import { memo, type ReactNode } from "react";

import { Card } from "@/components/ui/card";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectSourceStatus } from "@/app/store/slices/source-slice";
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

interface SourceCardProps {
  children: ReactNode;
  className?: string;
  source: EditingInstance;
}

const SourceCard = memo(function SourceCard({ children, className, source }: SourceCardProps) {
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourceStatus = useAppSelector(selectSourceStatus);

  const active = source.id === activeInstanceId;
  const { displayName } = source.snapshot.source;
  const status = getSourceCardStatus(source, active, sourceStatus);
  const variant = getSourceCardVariant(status, active);

  return (
    <SourceCardContext.Provider value={source}>
      <SourceCardContextMenu>
        <Card
          aria-checked={active}
          aria-label={displayName}
          className={cn("group/source-card cursor-pointer", className)}
          data-active={active ? "true" : "false"}
          data-source-id={source.id}
          hoverable
          onClick={() => void dispatch(navigateToEditingInstance(source.id))}
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
