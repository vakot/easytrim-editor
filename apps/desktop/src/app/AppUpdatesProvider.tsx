import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  checkForUpdates as checkForUpdatesNative,
  isTauriRuntime,
  type AvailableUpdate,
} from "@/lib/tauri/updates";
import { AppUpdatesContext, type UpdateStatus } from "@/app/update-context";

export function AppUpdatesProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const updateRef = useRef<AvailableUpdate | null>(null);
  const isCheckingRef = useRef(false);
  const isInstallingRef = useRef(false);

  const checkForUpdates = useCallback(async () => {
    if (isCheckingRef.current || isInstallingRef.current) return;

    isCheckingRef.current = true;
    updateRef.current = null;
    setAvailableVersion(null);
    setStatus("checking");

    try {
      const update = await checkForUpdatesNative();
      updateRef.current = update;
      setAvailableVersion(update?.version ?? null);
      setStatus(update ? "available" : "up-to-date");
    } catch {
      updateRef.current = null;
      setAvailableVersion(null);
      setStatus("error");
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update || isInstallingRef.current) return;

    isInstallingRef.current = true;
    setIsInstalling(true);

    try {
      await update.install();
      updateRef.current = null;
      setAvailableVersion(null);
      setStatus("idle");
    } catch {
      updateRef.current = null;
      setAvailableVersion(null);
      setStatus("error");
    } finally {
      isInstallingRef.current = false;
      setIsInstalling(false);
    }
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    const checkTimer = window.setTimeout(() => void checkForUpdates(), 0);
    return () => window.clearTimeout(checkTimer);
  }, [checkForUpdates]);

  return (
    <AppUpdatesContext.Provider
      value={{
        status,
        availableVersion,
        isInstalling,
        checkForUpdates,
        installUpdate,
      }}
    >
      {children}
    </AppUpdatesContext.Provider>
  );
}
