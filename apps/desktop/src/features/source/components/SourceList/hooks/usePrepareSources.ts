import { useEffect, useMemo, useState } from "react";

import { useAppDispatch } from "@/app/store/redux-hooks";
import {
  prepareImportedSourceMetadataRequested,
  prepareImportedSourceThumbnailsRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";

function usePrepareSources(instances: EditingInstance[]) {
  const dispatch = useAppDispatch();
  const preparationKey = JSON.stringify(
    instances.map(({ id, snapshot, sourceAvailability }) => [
      id,
      snapshot.source.sourcePath,
      sourceAvailability,
    ]),
  );

  const preparedInstances = useMemo(() => instances, [instances]);
  const [completedPreparationKey, setCompletedPreparationKey] = useState<string | null>(() =>
    preparedInstances.length === 0 ? preparationKey : null,
  );

  const isLoading = preparedInstances.length > 0 && completedPreparationKey !== preparationKey;

  useEffect(() => {
    if (preparedInstances.length === 0) return;

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
