import { Suspense, useCallback, useEffect, useState } from "react";

import { lazyWithPreload } from "@easytrim-editor/ui/lazy-component";

import type { DialogScope } from "@/components/ui/dialog";
import { createDialogScope, Dialog, DialogContent } from "@/components/ui/dialog";

import { useChangelogDialog } from "@/app/hooks/useAppDialog";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  changelogVersionSeen,
  selectLastSeenChangelogVersion,
} from "@/app/store/slices/preferences-slice";
import { getAvailableChangelog, getChangelogStartupState } from "@/features/changelog";
import { CHANGELOG } from "@/generated/changelog";
import { getCurrentVersion } from "@/lib/app-version.utils";

import type { AppChangelogDialogContentProps } from "./AppChangelogDialogContent";

const useAppChangelogDialogScope = createDialogScope();

const LazyAppChangelogDialogContent = lazyWithPreload<
  AppChangelogDialogContentProps & { __scopeDialog?: DialogScope }
>(() =>
  import("./AppChangelogDialogContent").then((module) => ({
    default: module.AppChangelogDialogContent,
  })),
);

const AppChangelogDialog = Object.assign(
  function AppChangelogDialog({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
    const dialogScope = useAppChangelogDialogScope(__scopeDialog);
    const dispatch = useAppDispatch();
    const lastSeenVersion = useAppSelector(selectLastSeenChangelogVersion);
    const { closeDialog, isManualOpen, isOpen, openDialogAutomatically } = useChangelogDialog();
    const currentVersion = getCurrentVersion();
    const [whatsNewDismissed, setWhatsNewDismissed] = useState(false);
    const availableReleases = getAvailableChangelog(CHANGELOG, currentVersion);
    const startupState = getChangelogStartupState(CHANGELOG, lastSeenVersion, currentVersion);
    const hasWhatsNew =
      !startupState.initializeSeenVersion &&
      startupState.unseenReleases.length > 0 &&
      !whatsNewDismissed;

    const mode = isOpen ? (!isManualOpen && hasWhatsNew ? "whats-new" : "changelog") : null;

    useEffect(() => {
      if (!startupState.initializeSeenVersion) return;

      // Existing installations have no changelog marker yet. Initialize at the
      // installed version so this feature does not replay the entire archive.
      dispatch(changelogVersionSeen(startupState.initializeSeenVersion));
    }, [dispatch, startupState.initializeSeenVersion]);

    useEffect(() => {
      if (!hasWhatsNew) return;

      let active = true;
      const openAfterPreload = () => {
        if (active) openDialogAutomatically();
      };

      void LazyAppChangelogDialogContent.preload().then(openAfterPreload, openAfterPreload);

      return () => {
        active = false;
      };
    }, [hasWhatsNew, openDialogAutomatically]);

    const handleClose = useCallback(() => {
      if (mode === "whats-new") {
        dispatch(changelogVersionSeen(currentVersion));
        setWhatsNewDismissed(true);
      }

      closeDialog();
    }, [closeDialog, currentVersion, dispatch, mode]);

    return (
      <Dialog {...dialogScope} onOpenChange={(open) => !open && handleClose()} open={isOpen}>
        <DialogContent
          {...dialogScope}
          className="grid max-h-[min(80dvh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-2xl"
        >
          <Suspense fallback={null}>
            <LazyAppChangelogDialogContent
              __scopeDialog={dialogScope.__scopeDialog}
              isWhatsNew={mode === "whats-new"}
              onClose={handleClose}
              releases={mode === "whats-new" ? startupState.unseenReleases : availableReleases}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppChangelogDialogContent.preload() },
);

export { AppChangelogDialog };
