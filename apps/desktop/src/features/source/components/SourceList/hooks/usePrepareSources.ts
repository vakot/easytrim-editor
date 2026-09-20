import { useEffect, useState } from "react";

import { useAppDispatch } from "@/app/store/redux-hooks";
import type { EditingInstance } from "@/domain/editing-instance";
import {
  prepareImportedSourceMetadataRequested,
  prepareImportedSourceThumbnailsRequested,
} from "@/app/store/thunks/source-media-thunks";

function usePrepareSources(instances: EditingInstance[]) {
  const dispatch = useAppDispatch();
  const [isPreparing, setIsPreparing] = useState(instances.length > 0);

  useEffect(() => {
    if (instances.length === 0) {
      setIsPreparing(false);
      return;
    }

    let isMounted = true;
    setIsPreparing(true);

    void Promise.all([
      dispatch(prepareImportedSourceMetadataRequested(instances)),
      dispatch(prepareImportedSourceThumbnailsRequested(instances)),
    ]).finally(() => {
      if (isMounted) setIsPreparing(false);
    });

    return () => {
      isMounted = false;
    };
  }, [dispatch, instances]);

  return isPreparing;
}

export { usePrepareSources };
