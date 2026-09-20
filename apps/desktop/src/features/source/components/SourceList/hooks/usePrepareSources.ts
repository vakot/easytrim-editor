import { useEffect, useMemo, useState } from "react";

import { useAppDispatch } from "@/app/store/redux-hooks";
import type { EditingInstance } from "@/domain/editing-instance";
import {
  prepareImportedSourceMetadataRequested,
  prepareImportedSourceThumbnailsRequested,
} from "@/app/store/thunks/source-media-thunks";

function usePrepareSources(instances: EditingInstance[]) {
  const dispatch = useAppDispatch();
  const preparationKey = JSON.stringify(
    instances.map(({ id, snapshot, sourceAvailability }) => [
      id,
      snapshot.source.sourcePath,
      sourceAvailability,
    ]),
  );
  const preparedInstances = useMemo(() => instances, [preparationKey]);
  const [completedPreparationKey, setCompletedPreparationKey] = useState<string | null>(() =>
    preparedInstances.length === 0 ? preparationKey : null,
  );

  const isLoading = preparedInstances.length > 0 && completedPreparationKey !== preparationKey;

  useEffect(() => {
    if (preparedInstances.length === 0) {
      setCompletedPreparationKey(preparationKey);
      return;
    }

    let isMounted = true;

    void Promise.all([
      dispatch(prepareImportedSourceMetadataRequested(preparedInstances)),
      dispatch(prepareImportedSourceThumbnailsRequested(preparedInstances)),
    ]).finally(() => {
      if (isMounted) setCompletedPreparationKey(preparationKey);
    });

    return () => {
      isMounted = false;
    };
  }, [dispatch, preparationKey, preparedInstances]);

  return isLoading;
}

export { usePrepareSources };
