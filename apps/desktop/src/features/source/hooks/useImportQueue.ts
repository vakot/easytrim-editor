import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  importQueueItemRemoved,
  selectActiveItemId,
  selectImportQueueItems,
} from "@/app/store/slices/export-slice";
import {
  closeActiveImportedItemRequested,
  deleteActiveImportedItemRequested,
  navigateToImportedItem,
} from "@/app/store/thunks/source-media-thunks";

function useImportQueue() {
  const dispatch = useAppDispatch();

  const items = useAppSelector(selectImportQueueItems);
  const activeItemId = useAppSelector(selectActiveItemId);

  const activeIndex = items.findIndex((item) => item.id === activeItemId);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  const isLast = activeIndex === items.length - 1;
  const isFirst = activeIndex === 0;

  const handleOpen = (id: string) => {
    dispatch(navigateToImportedItem(id));
  };

  const handleNext = () => {
    const next = items[activeIndex + 1];
    if (next) handleOpen(next.id);
  };

  const handlePrev = () => {
    const previous = items[activeIndex - 1];
    if (previous) handleOpen(previous.id);
  };

  const handleRemove = (id: string) => {
    if (id === activeItemId) {
      dispatch(closeActiveImportedItemRequested());
      return;
    }

    dispatch(importQueueItemRemoved(id));
  };

  const handleSkip = () => {
    if (activeItemId !== null) dispatch(closeActiveImportedItemRequested());
  };

  const handleDelete = () => dispatch(deleteActiveImportedItemRequested());

  return {
    isLast,
    isFirst,
    activeItem,
    activeIndex,
    items,
    next: handleNext,
    prev: handlePrev,
    open: handleOpen,
    remove: handleRemove,
    skip: handleSkip,
    deleteSource: handleDelete,
  };
}

export { useImportQueue };
