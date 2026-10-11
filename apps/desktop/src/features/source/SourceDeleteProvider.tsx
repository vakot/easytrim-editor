import { type PropsWithChildren, Suspense, useCallback, useMemo, useState } from "react";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import { SourceDeleteContext, type SourceDeleteRequest } from "./contexts/source-delete-context";

const LazySourceDeleteDialog = lazyWithPreload<{
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sourceIds: string[];
  target?: "file" | "folder";
  targetName?: string;
}>(() =>
  import("./components/SourceDeleteDialog").then((module) => ({
    default: module.SourceDeleteDialog,
  })),
);

const preloadSourceDeleteDialog = preloadOnIntent(() => LazySourceDeleteDialog.preload());

function SourceDeleteProvider({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<SourceDeleteRequest | null>(null);
  const requestSourceDelete = useCallback((nextRequest: SourceDeleteRequest) => {
    if (nextRequest.sourceIds.length === 0) return;
    preloadSourceDeleteDialog();
    setRequest({ ...nextRequest, sourceIds: [...new Set(nextRequest.sourceIds)] });
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
        <Suspense fallback={null}>
          <LazySourceDeleteDialog
            onOpenChange={(open) => {
              if (!open) setRequest(null);
            }}
            open
            sourceIds={[...request.sourceIds]}
            target={request.target}
            targetName={request.targetName}
          />
        </Suspense>
      ) : null}
    </SourceDeleteContext.Provider>
  );
}

export { SourceDeleteProvider };
