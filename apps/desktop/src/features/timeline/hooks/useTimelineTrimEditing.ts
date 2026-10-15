import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectTrim, trimChanged } from "@/app/store/slices/trim-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";

import { useTimelineRangeEditing } from "./useTimelineRangeEditing";

/** Trim editing in time, committing the selection the export uses. */
function useTimelineTrimEditing() {
  const trim = useAppSelector(selectTrim);
  const dispatch = useAppDispatch();

  return useTimelineRangeEditing(trim, (value) => {
    dispatch(trimChanged({ trim: value }));
    dispatch(commitActiveEditingInstanceDraft());
  });
}

export { useTimelineTrimEditing };
