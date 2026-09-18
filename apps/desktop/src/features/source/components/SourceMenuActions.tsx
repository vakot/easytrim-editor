import { cloneElement, type ReactElement } from "react";

import { useAppDispatch } from "@/app/store/redux-hooks";
import {
  closeEditingInstancesRequested,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./DeleteSourceDialog";

type MenuItemElement = ReactElement<{
  disabled?: boolean;
  onSelect?: (event: Event) => void;
}>;

interface MenuSourceActionProps {
  children: MenuItemElement;
  source: EditingInstance;
}

interface MenuSourcesActionProps {
  children: MenuItemElement;
  sources: EditingInstance[];
}

/**
 * @name MenuDeleteSource
 * @description Wraps a menu item with source deletion behavior and disables it when the source is already deleted.
 */
export function MenuDeleteSource({ children, source }: MenuSourceActionProps) {
  const item = withDisabled(children, source.sourceAvailability === "deleted");

  return (
    <DeleteSourceDialog sourceId={source.id}>
      <DeleteSourceDialogTrigger asChild>{withPreventedSelect(item)}</DeleteSourceDialogTrigger>
    </DeleteSourceDialog>
  );
}

/**
 * @name MenuDeleteSources
 * @description Wraps a menu item with deletion behavior for a source range and disables it when every source is already deleted.
 */
export function MenuDeleteSources({ children, sources }: MenuSourcesActionProps) {
  const canDelete = sources.some((source) => source.sourceAvailability !== "deleted");
  const item = withDisabled(children, !canDelete);

  return (
    <DeleteSourceDialog sourceIds={sources.map(({ id }) => id)}>
      <DeleteSourceDialogTrigger asChild>{withPreventedSelect(item)}</DeleteSourceDialogTrigger>
    </DeleteSourceDialog>
  );
}

/**
 * @name MenuCloseSource
 * @description Adds the action that closes one source editing instance to a compatible menu item.
 */
export function MenuCloseSource({ children, source }: MenuSourceActionProps) {
  const dispatch = useAppDispatch();

  return withSelectAction(children, () => {
    void dispatch(closeEditingInstancesRequested([source.id]));
  });
}

/**
 * @name MenuCloseSources
 * @description Adds the action that closes every source editing instance in a range to a compatible menu item.
 */
export function MenuCloseSources({ children, sources }: MenuSourcesActionProps) {
  const dispatch = useAppDispatch();

  return withSelectAction(children, () => {
    void dispatch(closeEditingInstancesRequested(sources.map(({ id }) => id)));
  });
}

/**
 * @name MenuRestoreSource
 * @description Adds source restoration behavior to a compatible menu item for a deleted source.
 */
export function MenuRestoreSource({ children, source }: MenuSourceActionProps) {
  const dispatch = useAppDispatch();
  if (source.sourceAvailability !== "deleted") return null;

  return withSelectAction(children, () => {
    void dispatch(
      restoreSourceFileRequested({
        itemId: source.id,
        sourcePath: source.snapshot.source.sourcePath,
      }),
    );
  });
}

/**
 * @name MenuRestoreSources
 * @description Adds source restoration behavior to a compatible menu item for every deleted source in a range.
 */
export function MenuRestoreSources({ children, sources }: MenuSourcesActionProps) {
  const dispatch = useAppDispatch();
  const restorableSources = sources.filter((source) => source.sourceAvailability === "deleted");
  if (restorableSources.length === 0) return null;

  return withSelectAction(children, () => {
    void Promise.all(
      restorableSources.map((source) =>
        dispatch(
          restoreSourceFileRequested({
            itemId: source.id,
            sourcePath: source.snapshot.source.sourcePath,
          }),
        ),
      ),
    );
  });
}

function withDisabled(children: MenuItemElement, disabled: boolean) {
  return cloneElement(children, { disabled });
}

function withSelectAction(children: MenuItemElement, action: () => void) {
  return cloneElement(children, {
    onSelect: (event: Event) => {
      children.props.onSelect?.(event);
      if (!event.defaultPrevented) action();
    },
  });
}

function withPreventedSelect(children: MenuItemElement) {
  return cloneElement(children, {
    onSelect: (event: Event) => {
      children.props.onSelect?.(event);
      event.preventDefault();
    },
  });
}
