import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ExportToast } from "@/features/export";
import {
  exportPresetReducer,
  loadExportPresetState,
  persistExportPresetState,
} from "@/features/export/export-presets";
import {
  availableQueueFinishActions,
  performQueueFinishAction,
  type QueueFinishAction,
} from "@/lib/tauri/queue";
import {
  cancelActiveExport,
  cancelAllQueuedExports,
  setExportQueueExecutionEnabled,
} from "@/features/export/utils/export-queue";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";

export function useEasyTrimEditorApp() {
  const [exportQueue, setExportQueue] = useState<ExportToast[]>([]);
  const [queueStarted, setQueueStarted] = useState(false);
  const [queueFinishAction, setQueueFinishAction] = useState<QueueFinishAction>("nothing");
  const [availableQueueFinishActionsState, setAvailableQueueFinishActionsState] = useState<
    QueueFinishAction[]
  >(["exit", "nothing"]);
  const [exportPresets, dispatchExportPreset] = useReducer(
    exportPresetReducer,
    undefined,
    loadExportPresetState,
  );
  const queueHadWorkRef = useRef(false);
  const suppressQueueFinishActionRef = useRef(false);

  useEffect(() => {
    setExportQueueExecutionEnabled(queueStarted);
  }, [queueStarted]);

  useEffect(() => {
    let active = true;
    void availableQueueFinishActions()
      .then((actions) => {
        if (active) {
          setAvailableQueueFinishActionsState(actions.includes("nothing") ? actions : ["nothing"]);
        }
      })
      .catch(() => {
        // Keep the safe default when the optional native capability probe fails.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const hasWork = exportQueue.some(
      (toast) => toast.status === "queued" || toast.status === "rendering",
    );
    if (hasWork) {
      queueHadWorkRef.current = true;
      return;
    }
    if (!queueHadWorkRef.current) return;

    queueHadWorkRef.current = false;
    if (suppressQueueFinishActionRef.current) {
      suppressQueueFinishActionRef.current = false;
      return;
    }
    if (!exportQueue.some((toast) => toast.status === "completed" || toast.status === "failed")) {
      return;
    }
    if (queueFinishAction !== "nothing") {
      void performQueueFinishAction(queueFinishAction).catch(() => undefined);
    }
  }, [exportQueue, queueFinishAction]);

  useEffect(() => {
    persistExportPresetState(exportPresets);
  }, [exportPresets]);

  const handleQueueStartedChange = useCallback((enabled: boolean) => {
    setQueueStarted(enabled);
    setExportQueueExecutionEnabled(enabled);
  }, []);

  useKeyboardShortcut(
    (event) =>
      event.key === "Enter" &&
      !queueStarted &&
      exportQueue.some((toast) => toast.status === "queued") &&
      document.activeElement === document.body,
    () => handleQueueStartedChange(true),
  );

  const handleCancelQueue = useCallback(() => {
    suppressQueueFinishActionRef.current = true;
    cancelAllQueuedExports();
  }, []);

  return {
    exportQueue,
    queueStarted,
    queueFinishAction,
    availableQueueFinishActions: availableQueueFinishActionsState,
    exportPresets,
    dispatchExportPreset,
    setExportQueue,
    setQueueStarted: handleQueueStartedChange,
    cancelActiveExport,
    cancelQueue: handleCancelQueue,
    setQueueFinishAction,
  };
}
