import type { TFunction } from "i18next";

import { isWindowsRuntime } from "@/lib/tauri/updates.utils";

function getRevealLabel(t: TFunction): string {
  if (isMacOSRuntime()) return t("source.actions.revealInFinder");
  if (isWindowsRuntime()) return t("source.actions.revealInFileExplorer");
  return t("source.actions.revealInFileManager");
}

function isMacOSRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (/Mac/i.test(navigator.userAgent) || /Mac/i.test(navigator.platform))
  );
}

function getPathDirectories(path: string): Array<{ name: string; path: string }> {
  const separator = path.includes("\\") ? "\\" : "/";
  const directoryPath = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
  const driveRoot = directoryPath.match(/^[A-Za-z]:[\\/]/)?.[0];
  const root = directoryPath.startsWith(separator) ? separator : "";
  let currentPath = driveRoot ?? root;

  const directories = directoryPath.slice(currentPath.length).split(/[\\/]/).filter(Boolean);

  if (driveRoot) {
    directories.unshift(driveRoot.slice(0, 2));
  }

  return directories.map((name) => {
    if (name === driveRoot?.slice(0, 2)) {
      currentPath = driveRoot;
    } else {
      currentPath = currentPath
        ? `${currentPath}${currentPath.endsWith(separator) ? "" : separator}${name}`
        : name;
    }

    return { name, path: currentPath };
  });
}

export { getPathDirectories, getRevealLabel };
