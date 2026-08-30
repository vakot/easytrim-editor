import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveItemId, selectImportQueueItems } from "@/app/store/slices/export-slice";
import { navigateToImportedItem } from "@/app/store/thunks/source-media-thunks";

function useImportQueue() {
  const dispatch = useAppDispatch();

  const items = useAppSelector(selectImportQueueItems);
  const activeItemId = useAppSelector(selectActiveItemId);

  const activeIndex = items.findIndex((item) => item.id === activeItemId);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  const isLast = activeIndex === items.length - 1;
  const isFirst = activeIndex === 0;

  const handleNext = () => {
    const next = items[activeIndex + 1];
    if (next) dispatch(navigateToImportedItem(next.id));
  };

  const handlePrev = () => {
    const previous = items[activeIndex - 1];
    if (previous) dispatch(navigateToImportedItem(previous.id));
  };

  const handleOpen = () => {};

  return {
    isLast,
    isFirst,
    activeItem,
    activeIndex,
    items,
    open: handleOpen,
    next: handleNext,
    prev: handlePrev,
  };
}

export { useImportQueue };
