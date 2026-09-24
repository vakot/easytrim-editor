import { type PropsWithChildren, useCallback, useMemo, useState } from "react";

import { SourceDeleteDialog } from "./components/SourceDeleteDialog";
import { SourceDeleteContext, type SourceDeleteRequest } from "./contexts/source-delete-context";

function SourceDeleteProvider({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<SourceDeleteRequest | null>(null);
  const requestSourceDelete = useCallback((nextRequest: SourceDeleteRequest) => {
    if (nextRequest.sourceIds.length === 0) return;
    setRequest({ ...nextRequest, sourceIds: [...new Set(nextRequest.sourceIds)] });
  }, []);

  const context = useMemo(() => ({ requestSourceDelete }), [requestSourceDelete]);

  return (
    <SourceDeleteContext.Provider value={context}>
      {children}
      <SourceDeleteDialog
        onOpenChange={(open) => {
          if (!open) setRequest(null);
        }}
        open={request !== null}
        sourceIds={request ? [...request.sourceIds] : []}
        target={request?.target}
        targetName={request?.targetName}
      />
    </SourceDeleteContext.Provider>
  );
}

export { SourceDeleteProvider };
