import { type PropsWithChildren, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { preferenceChanged } from "@/app/store/slices/preferences-slice";

import { QueueDeleteSourceContext } from "./contexts/queue-delete-source-context";

function QueueDeleteSourceProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [requested, setRequested] = useState(false);

  const requestEnableSourceDeletion = useCallback(() => setRequested(true), []);
  const close = useCallback(() => setRequested(false), []);
  const confirm = useCallback(() => {
    dispatch(preferenceChanged({ enabled: true, key: "deleteSourceOnRenderFinish" }));
    setRequested(false);
  }, [dispatch]);

  return (
    <QueueDeleteSourceContext.Provider value={{ requestEnableSourceDeletion }}>
      {children}
      <AlertDialog onOpenChange={(open) => !open && close()} open={requested}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("queue.dialogs.deleteSourceOnRenderFinish.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("queue.dialogs.deleteSourceOnRenderFinish.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.actions.back")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} variant="destructive">
              {t("common.actions.enable")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </QueueDeleteSourceContext.Provider>
  );
}

export { QueueDeleteSourceProvider };
