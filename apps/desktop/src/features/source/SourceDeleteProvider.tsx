import { type PropsWithChildren, useCallback, useMemo, useState } from "react";

import { preloadOnIntent } from "@/lib/lazy-component";

import { SourceDeleteContext, type SourceDeleteRequest } from "./contexts/source-delete-context";
import { SourceDeleteDialog } from "./dialogs/SourceDeleteDialog";

const preloadSourceDeleteDialog = preloadOnIntent(SourceDeleteDialog.preload);

function SourceDeleteProvider({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<SourceDeleteRequest | null>(null);
  const requestSourceDelete = useCallback((nextRequest: SourceDeleteRequest) => {
    if (nextRequest.sourceIds.length === 0) return;
    const normalizedRequest = { ...nextRequest, sourceIds: [...new Set(nextRequest.sourceIds)] };
    const openAfterPreload = () => setRequest(normalizedRequest);

    void SourceDeleteDialog.preload().then(openAfterPreload, openAfterPreload);
  }, []);

  const preloadSourceDelete = useCallback(() => preloadSourceDeleteDialog(), []);

  const context = useMemo(
    () => ({ preloadSourceDelete, requestSourceDelete }),
    [preloadSourceDelete, requestSourceDelete],
  );

  return (
    <SourceDeleteContext.Provider value={context}>
      {children}
      {request ? (
        <SourceDeleteDialog
          onOpenChange={(open) => {
            if (!open) setRequest(null);
          }}
          open
          sourceIds={request.sourceIds}
          target={request.target}
          targetName={request.targetName}
        />
      ) : null}
    </SourceDeleteContext.Provider>
  );
}

export { SourceDeleteProvider };
