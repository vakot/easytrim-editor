import type { EditingInstance } from "@/domain/editing-instance";

export function getReplacementEditingInstance(
  instances: EditingInstance[],
  currentIndex: number,
): EditingInstance | null {
  return instances[currentIndex + 1] ?? instances[currentIndex - 1] ?? null;
}
