import {
  usageStatisticsLoaded,
  usageStatisticsLoadFailed,
  usageStatisticsRequested,
} from "@/app/store/slices/usage-statistics-slice";
import { getUsageStatistics } from "@/lib/tauri/statistics";

import type { AppThunk } from "./source-media-thunks";

/** Reads the native statistics; only the latest request may update the store. */
const loadUsageStatistics = (): AppThunk => async (dispatch) => {
  const requestId = crypto.randomUUID();
  dispatch(usageStatisticsRequested({ requestId }));
  try {
    const statistics = await getUsageStatistics();
    dispatch(usageStatisticsLoaded({ requestId, statistics }));
  } catch {
    dispatch(usageStatisticsLoadFailed({ requestId }));
  }
};

export { loadUsageStatistics };
