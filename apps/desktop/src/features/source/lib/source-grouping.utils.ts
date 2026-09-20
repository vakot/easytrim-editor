import type { EditingInstance } from "@/domain/editing-instance";

export interface SourceGroup<T> {
  items: T[];
  key: string;
  label: string;
}

export function getSourceFolderPath(sourcePath: string): string {
  const separatorIndex = Math.max(sourcePath.lastIndexOf("/"), sourcePath.lastIndexOf("\\"));
  if (separatorIndex < 0) return "";

  const folderPath = sourcePath.slice(0, separatorIndex);
  if (/^[A-Za-z]:$/.test(folderPath)) return sourcePath.slice(0, separatorIndex + 1);
  return folderPath || sourcePath.slice(0, separatorIndex + 1);
}

export function groupSourcesByFolder(
  sources: readonly EditingInstance[],
): SourceGroup<EditingInstance>[] {
  const groups = new Map<string, SourceGroup<EditingInstance>>();

  for (const source of sources) {
    const folderPath = getSourceFolderPath(source.snapshot.source.sourcePath);
    const key = normalizeFolderKey(folderPath);
    const group = groups.get(key);

    if (group) {
      group.items.push(source);
    } else {
      groups.set(key, { items: [source], key, label: folderPath || "." });
    }
  }

  return [...groups.values()];
}

function normalizeFolderKey(folderPath: string): string {
  const normalized = folderPath.replace(/[\\/]+/g, "/");
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}
