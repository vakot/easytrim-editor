import { useEffect, useState } from "react";

import { useAppDispatch } from "@/app/store/redux-hooks";
import type { EditingInstance } from "@/domain/editing-instance";
import {
  prepareImportedSourceMetadataRequested,
  prepareImportedSourceThumbnailsRequested,
} from "@/app/store/thunks/source-media-thunks";

function usePrepareSources(instances: EditingInstance[]) {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(instances.length > 0);

  useEffect(() => {
    if (instances.length === 0) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    void Promise.all([
      dispatch(prepareImportedSourceMetadataRequested(instances)),
      dispatch(prepareImportedSourceThumbnailsRequested(instances)),
    ]).finally(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [dispatch, instances]);

  return isLoading;
}

export { usePrepareSources };
