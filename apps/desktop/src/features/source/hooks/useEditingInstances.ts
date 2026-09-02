import { useMemo } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { closeActiveEditingInstanceRequested } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";

const getEditingInstanceStatus = (instance: EditingInstance) => {
  const attempt = instance.exportAttempts.at(-1);

  const status =
    instance.sourceAvailability === "deleted"
      ? "deleted"
      : (attempt?.state.status ?? (instance.media ? "ready" : undefined));

  return status;
};

export function useEditingInstances() {
  const dispatch = useAppDispatch();

  const instances = useAppSelector(selectEditingInstances);
  const activeInstanceId = useAppSelector(selectActiveInstanceId);

  const readyInstances = useMemo(
    () => instances.filter((instance) => !!getEditingInstanceStatus(instance)),
    [instances],
  );

  const closeInstance = async (id: string) => {
    await dispatch(closeActiveEditingInstanceRequested(id));
  };

  const closeInstances = (ids: string[]) => {
    ids.forEach(closeInstance);
  };

  return { instances, readyInstances, activeInstanceId, closeInstances, closeInstance };
}
