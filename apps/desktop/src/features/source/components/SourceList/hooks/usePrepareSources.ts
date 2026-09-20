import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectImportedEditingInstances } from "@/app/store/slices/editing-instances-slice";
import {
  prepareImportedSourceMetadataRequested,
  prepareImportedSourceThumbnailsRequested,
} from "@/app/store/thunks/source-media-thunks";

function usePrepareSources() {
  const dispatch = useAppDispatch();
  const instances = useAppSelector(selectImportedEditingInstances);

  useEffect(() => {
    void dispatch(prepareImportedSourceMetadataRequested(instances));
    void dispatch(prepareImportedSourceThumbnailsRequested(instances));
  }, [dispatch, instances]);

  return instances;
}

export { usePrepareSources };
