import { type PropsWithChildren, useCallback, useState } from "react";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { preferenceChanged } from "@/app/store/slices/preferences-slice";

import { QueueDeleteSourceContext } from "./contexts/queue-delete-source-context";
import { QueueDeleteSourceDialog } from "./dialogs/QueueDeleteSourceDialog";

function QueueDeleteSourceProvider({ children }: PropsWithChildren) {
  const dispatch = useAppDispatch();
  const [requested, setRequested] = useState(false);

  const requestEnableSourceDeletion = useCallback(() => {
    const openAfterPreload = () => setRequested(true);

    void QueueDeleteSourceDialog.preload().then(openAfterPreload, openAfterPreload);
  }, []);

  const close = useCallback(() => setRequested(false), []);
  const confirm = useCallback(() => {
    dispatch(preferenceChanged({ enabled: true, key: "deleteSourceOnRenderFinish" }));
    setRequested(false);
  }, [dispatch]);

  return (
    <QueueDeleteSourceContext.Provider value={{ requestEnableSourceDeletion }}>
      {children}
      <QueueDeleteSourceDialog
        onConfirm={confirm}
        onOpenChange={(open) => !open && close()}
        open={requested}
      />
    </QueueDeleteSourceContext.Provider>
  );
}

export { QueueDeleteSourceProvider };
