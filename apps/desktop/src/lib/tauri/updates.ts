import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

const updaterEndpoint =
  "https://github.com/vakot/easytrim-editor/releases/latest/download/latest.json";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface AvailableUpdate {
  version: string;
  install: () => Promise<void>;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isWindowsRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (/Windows/i.test(navigator.userAgent) || /Win/i.test(navigator.platform))
  );
}

export async function checkForUpdates(): Promise<AvailableUpdate | null> {
  try {
    const update = await check();
    if (!update) return null;

    return {
      version: update.version,
      install: async () => {
        try {
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
