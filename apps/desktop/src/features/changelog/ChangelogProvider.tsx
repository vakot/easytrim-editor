import { type PropsWithChildren, useEffect, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  changelogVersionSeen,
  selectLastSeenChangelogVersion,
} from "@/app/store/slices/preferences-slice";
import { CHANGELOG } from "@/generated/changelog";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { preloadOnIntent } from "@/lib/lazy-component";

import { ChangelogDialogContext } from "./contexts/changelog-dialog-context";
import { ChangelogDialog } from "./dialogs/ChangelogDialog/ChangelogDialog";
import { getAvailableChangelog, getChangelogStartupState } from "./lib/changelog.utils";

const preloadChangelogDialog = preloadOnIntent(() => ChangelogDialog.preload());

function ChangelogProvider({ children }: PropsWithChildren) {
  const dispatch = useAppDispatch();
  const lastSeenVersion = useAppSelector(selectLastSeenChangelogVersion);
  const currentVersion = getCurrentVersion();
  const [manualOpen, setManualOpen] = useState(false);
  const [whatsNewDismissed, setWhatsNewDismissed] = useState(false);
  const availableReleases = getAvailableChangelog(CHANGELOG, currentVersion);
  const startupState = getChangelogStartupState(CHANGELOG, lastSeenVersion, currentVersion);
  const unseenReleases = startupState.unseenReleases;
  const mode = manualOpen
    ? "changelog"
    : !whatsNewDismissed && !startupState.initializeSeenVersion && unseenReleases.length > 0
      ? "whats-new"
      : null;

  useEffect(() => {
    if (startupState.initializeSeenVersion) {
      // Existing installations have no changelog marker yet. Initialize at the
      // installed version so this feature does not replay the entire archive.
      dispatch(changelogVersionSeen(startupState.initializeSeenVersion));
      return;
    }
  }, [dispatch, startupState.initializeSeenVersion]);

  const closeDialog = () => {
    if (mode === "whats-new") {
      dispatch(changelogVersionSeen(currentVersion));
      setWhatsNewDismissed(true);
      return;
    }
    setManualOpen(false);
  };

  const openChangelog = () => {
    preloadChangelogDialog();
    setManualOpen(true);
  };

  return (
    <ChangelogDialogContext.Provider
      value={{ openChangelog, preloadChangelog: preloadChangelogDialog }}
    >
      {children}
      <ChangelogDialog
        mode={mode}
        onClose={closeDialog}
        releases={mode === "whats-new" ? unseenReleases : availableReleases}
      />
    </ChangelogDialogContext.Provider>
  );
}

export { ChangelogProvider };
