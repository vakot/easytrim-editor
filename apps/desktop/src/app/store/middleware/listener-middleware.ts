import { createListenerMiddleware } from "@reduxjs/toolkit";

import type { RootState } from "../store";

export const listenerMiddleware = createListenerMiddleware<RootState>();
