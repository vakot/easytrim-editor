import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  dismissWorkspaceRecoveryNotice,
  getWorkspaceRecoveryCandidate,
  isWorkspaceRecoveryNoticeDismissed,
  subscribeToWorkspaceRecovery,
} from "@/app/store/recovery/workspace-recovery";
import { restorePreviousWorkspaceRequested } from "@/app/store/recovery/workspace-recovery-thunks";
import { selectEditingInstances } from "@/app/store/slices/editing-instances-slice";
import { Button } from "@/components/ui/button";

function WorkspaceRecoveryNotice() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const instances = useAppSelector(selectEditingInstances);
  const candidate = useSyncExternalStore(
    subscribeToWorkspaceRecovery,
    getWorkspaceRecoveryCandidate,
    () => null,
  );
  const dismissed = useSyncExternalStore(
    subscribeToWorkspaceRecovery,
    isWorkspaceRecoveryNoticeDismissed,
    () => true,
  );
  const [consumed, setConsumed] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (instances.length > 0) setConsumed(true);
  }, [instances.length]);

  if (!candidate || dismissed || consumed || instances.length > 0) return null;

  return (
    <aside
      aria-label={t("app.workspaceRecovery.title")}
      className="fixed right-5 bottom-5 z-50 grid w-[min(24rem,calc(100vw-2.5rem))] gap-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl"
      role="status"
    >
      <div className="grid gap-1">
        <strong className="text-sm">{t("app.workspaceRecovery.title")}</strong>
        <p className="text-sm text-muted-foreground">
          {t("app.workspaceRecovery.description", { count: candidate.instances.length })}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          onClick={() => {
            dismissWorkspaceRecoveryNotice();
            setConsumed(true);
          }}
          type="button"
          variant="ghost"
        >
          {t("app.workspaceRecovery.dismiss")}
        </Button>
        <Button
          disabled={restoring}
          onClick={() => {
            setConsumed(true);
            setRestoring(true);
            void dispatch(restorePreviousWorkspaceRequested()).finally(() => setRestoring(false));
          }}
          type="button"
        >
          {t("app.workspaceRecovery.restore")}
        </Button>
      </div>
    </aside>
  );
}

export { WorkspaceRecoveryNotice };
