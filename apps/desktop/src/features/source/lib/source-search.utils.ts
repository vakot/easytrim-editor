import type { EditingInstance } from "@/domain/editing-instance";

export function filterSourcesByPath(
  sources: EditingInstance[],
  search: string,
): EditingInstance[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (!normalizedSearch) return sources;

  return sources.filter(({ snapshot }) =>
    snapshot.source.sourcePath.toLocaleLowerCase().includes(normalizedSearch),
  );
}
