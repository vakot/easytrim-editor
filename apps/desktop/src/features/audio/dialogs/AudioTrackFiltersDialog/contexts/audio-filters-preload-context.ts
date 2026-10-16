import { createContext } from "react";

/**
 * Starts loading what opening the dialog needs: its content and the page that is selected first.
 * The dialog provides it because it knows which track's chain is shown.
 */
const AudioFiltersPreloadContext = createContext<() => void>(() => undefined);

export { AudioFiltersPreloadContext };
