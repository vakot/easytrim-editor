import type { HistoryData, HistoryOperation } from "./workspace-history";

export const HISTORY_MAX_OPERATIONS = 200;
// localStorage accounts for UTF-16 strings: this allows at most 512 KiB of history per backup.
export const HISTORY_MAX_SERIALIZED_LENGTH = 256 * 1024;

const serializedLengths = new WeakMap<HistoryOperation, number>();

/** Keep a contiguous range containing the current state; never skip a required replay step. */
export function retainWorkspaceHistory(
  data: HistoryData,
  maxSerializedLength = HISTORY_MAX_SERIALIZED_LENGTH,
): HistoryData {
  const limit = Math.min(maxSerializedLength, HISTORY_MAX_SERIALIZED_LENGTH);
  let start = 0;
  let end = data.operations.length;
  const lengths = data.operations.map((operation) => {
    let length = serializedLengths.get(operation);
    if (length === undefined) {
      length = JSON.stringify(operation).length;
      serializedLengths.set(operation, length);
    }
    return length;
  });

  let contentLength = lengths.reduce((sum, length) => sum + length, 0) + Math.max(0, end - 1);
  while (start < end) {
    const count = end - start;
    const envelopeLength = JSON.stringify({
      version: 1,
      operations: [],
      position: data.position - start,
    }).length;

    if (count <= HISTORY_MAX_OPERATIONS && contentLength + envelopeLength <= limit) break;
    // Removed applied operations become the new baseline. At that baseline, only the farthest
    // Redo operations may be dropped; removing the next Redo would break the remaining chain.
    const index = start < data.position ? start++ : --end;
    contentLength -= lengths[index]! + (count > 1 ? 1 : 0);
  }
  if (start === 0 && end === data.operations.length) return data;
  return {
    version: 1,
    operations: data.operations.slice(start, end),
    position: data.position - start,
  };
}
