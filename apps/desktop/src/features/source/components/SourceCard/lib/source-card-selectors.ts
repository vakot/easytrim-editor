import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectSourceStatus, type SourceStatus } from "@/app/store/slices/source-slice";
import type { RootState } from "@/app/store/store";
import type { EditingInstanceId } from "@/domain/editing-instance";

function createSelectSourceCardActive(instanceId: EditingInstanceId) {
  return (state: RootState) => selectActiveInstanceId(state) === instanceId;
}

function createSelectSourceCardStatus(instanceId: EditingInstanceId) {
  return (state: RootState): SourceStatus =>
    selectActiveInstanceId(state) === instanceId ? selectSourceStatus(state) : "idle";
}

export { createSelectSourceCardActive, createSelectSourceCardStatus };
