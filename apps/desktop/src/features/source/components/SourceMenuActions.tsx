import { cloneElement, type MouseEventHandler, type ReactElement } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceExportQueueState } from "@/app/store/slices/export-slice";
import { cancelSourceExportQueue, startSourceExportQueue } from "@/app/store/thunks/export-thunks";
import {
  closeEditingInstancesRequested,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";

import { SourceDeleteDialog, SourceDeleteDialogTrigger } from "./SourceDeleteDialog";

type ActionElement = ReactElement<{
  disabled?: boolean;
  onClick?: MouseEventHandler;
  onSelect?: (event: Event) => void;
}>;

interface SourceActionProps {
  children: ActionElement;
  event?: "click" | "select";
  itemId?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  source?: EditingInstance;
  sources?: EditingInstance[];
  sourcePath?: string;
}

/**
 * @name DeleteSource
 * @description Wraps an action trigger with source deletion behavior and disables it when the source is already deleted.
 */
function DeleteSource({
  children,
  event = "select",
  onOpenChange,
  open,
  source,
}: SourceActionProps) {
  const item = withDisabled(children, !source || source.sourceAvailability === "deleted");

  return (
    <SourceDeleteDialog onOpenChange={onOpenChange} open={open} sourceId={source?.id}>
      <SourceDeleteDialogTrigger asChild>
        {event === "select" ? withPreventedSelect(item) : item}
      </SourceDeleteDialogTrigger>
    </SourceDeleteDialog>
  );
}

/**
 * @name CloseSource
 * @description Adds the action that closes one source editing instance to a compatible action trigger.
 */
function CloseSource({ children, event = "select", source }: SourceActionProps) {
  const dispatch = useAppDispatch();

  return withAction(withDisabled(children, !source), event, () => {
    if (source) void dispatch(closeEditingInstancesRequested([source.id]));
  });
}

/**
 * @name CloseSources
 * @description Adds batch close behavior to a compatible action trigger for multiple source editing instances.
 */
function CloseSources({ children, event = "select", sources = [] }: SourceActionProps) {
  const dispatch = useAppDispatch();
  const sourceIds = sources.map(({ id }) => id);

  return withAction(
    withDisabled(children, sourceIds.length === 0),
    event,
    () => void dispatch(closeEditingInstancesRequested(sourceIds)),
  );
}

/**
 * @name StartSourceExport
 * @description Adds per-source queue start behavior and disables the trigger when no export is queued.
 */
function StartSourceExport({ children, event = "select", source }: SourceActionProps) {
  const dispatch = useAppDispatch();
  const queue = useAppSelector((state) => selectSourceExportQueueState(state, source?.id ?? ""));

  return withAction(
    withDisabled(children, !source || !queue.hasQueuedExports || queue.isRunning),
    event,
    () => {
      if (source) void dispatch(startSourceExportQueue(source.id));
    },
  );
}

/**
 * @name CancelSourceExport
 * @description Adds per-source queue cancellation behavior and disables the trigger when the source is idle.
 */
function CancelSourceExport({ children, event = "select", source }: SourceActionProps) {
  const dispatch = useAppDispatch();
  const queue = useAppSelector((state) => selectSourceExportQueueState(state, source?.id ?? ""));

  return withAction(withDisabled(children, !source || !queue.isRunning), event, () => {
    if (source) void dispatch(cancelSourceExportQueue(source.id));
  });
}

/**
 * @name RestoreSource
 * @description Adds source restoration behavior to a compatible action trigger for a deleted source or a source path without an open instance.
 */
function RestoreSource({
  children,
  event = "select",
  itemId,
  source,
  sourcePath,
}: SourceActionProps) {
  const dispatch = useAppDispatch();
  const targetId = source?.id ?? itemId;
  const targetPath = source?.snapshot.source.sourcePath ?? sourcePath;

  if (!targetPath || (source && source.sourceAvailability !== "deleted")) return null;

  return withAction(children, event, () => {
    void dispatch(
      restoreSourceFileRequested({
        ...(targetId ? { itemId: targetId } : {}),
        sourcePath: targetPath,
      }),
    );
  });
}

function withDisabled(children: ActionElement, disabled: boolean) {
  return cloneElement(children, { disabled: disabled || Boolean(children.props.disabled) });
}

function withAction(children: ActionElement, event: "click" | "select", action: () => void) {
  if (event === "click") {
    return cloneElement(children, {
      onClick: (clickEvent) => {
        children.props.onClick?.(clickEvent);
        if (!clickEvent.defaultPrevented) action();
      },
    });
  }

  return cloneElement(children, {
    onSelect: (selectEvent: Event) => {
      children.props.onSelect?.(selectEvent);
      if (!selectEvent.defaultPrevented) action();
    },
  });
}

function withPreventedSelect(children: ActionElement) {
  return cloneElement(children, {
    onSelect: (event: Event) => {
      children.props.onSelect?.(event);
      event.preventDefault();
    },
  });
}

export {
  CancelSourceExport,
  CloseSource,
  CloseSources,
  DeleteSource,
  RestoreSource,
  StartSourceExport,
};
