import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

import { completeDiagnosticsSession } from "./diagnostics";
import type { AvailableUpdate } from "./updates.types";
import { getErrorMessage, isWindowsRuntime } from "./updates.utils";

const updaterEndpoint =
  "https://github.com/vakot/easytrim-editor/releases/latest/download/latest.json";

export async function checkForUpdates(): Promise<AvailableUpdate | null> {
  try {
    const update = await check();
    if (!update) return null;

    return {
      version: update.version,
      install: async () => {
        try {
          await completeDiagnosticsSession();
          await update.downloadAndInstall();
          console.info("[updates] Update installer launched", {
            version: update.version,
            relaunchRequired: !isWindowsRuntime(),
          });

          // Windows exits the application automatically when the installer is
          // launched. Calling relaunch here can report a false installation
          // failure after the update has already started.
          if (!isWindowsRuntime()) {
            await relaunch();
          }
        } catch (error) {
          console.error("[updates] Update installation failed", {
            message: getErrorMessage(error),
            version: update.version,
          });
          throw error;
        }
      },
    };
  } catch (error) {
    console.error("[updates] Update check failed", {
      endpoint: updaterEndpoint,
      message: getErrorMessage(error),
    });
    throw error;
  }
}
