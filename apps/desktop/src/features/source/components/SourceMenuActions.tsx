import { cloneElement, type MouseEventHandler, type ReactElement } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceExportQueueState } from "@/app/store/slices/export-slice";
import { cancelSourceExportQueue, startSourceExportQueue } from "@/app/store/thunks/export-thunks";
import {
  closeEditingInstancesRequested,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./DeleteSourceDialog";

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
  sourcePath?: string;
}

/**
 * @name DeleteSource
 * @description Wraps an action trigger with source deletion behavior and disables it when the source is already deleted.
 */
export function DeleteSource({
  children,
  event = "select",
  onOpenChange,
  open,
  source,
}: SourceActionProps) {
  const item = withDisabled(children, !source || source.sourceAvailability === "deleted");

  return (
    <DeleteSourceDialog onOpenChange={onOpenChange} open={open} sourceId={source?.id}>
      <DeleteSourceDialogTrigger asChild>
        {event === "select" ? withPreventedSelect(item) : item}
      </DeleteSourceDialogTrigger>
    </DeleteSourceDialog>
  );
}

/**
 * @name CloseSource
 * @description Adds the action that closes one source editing instance to a compatible action trigger.
 */
export function CloseSource({ children, event = "select", source }: SourceActionProps) {
  const dispatch = useAppDispatch();

  return withAction(withDisabled(children, !source), event, () => {
    if (source) void dispatch(closeEditingInstancesRequested([source.id]));
  });
}

/**
 * @name StartSourceExport
 * @description Adds per-source queue start behavior and disables the trigger when no export is queued.
 */
export function StartSourceExport({ children, event = "select", source }: SourceActionProps) {
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
export function CancelSourceExport({ children, event = "select", source }: SourceActionProps) {
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
export function RestoreSource({
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
