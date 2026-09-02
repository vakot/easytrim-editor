import { useMemo } from "react";

import type { EditingInstance } from "@/domain/editing-instance";

import { SourceTreeNodes } from "./components/SourceTreeNodes";
import { useEditingInstances } from "./hooks/useEditingInstances";
import { getSourceTreeNodes } from "./lib/source-tree.utils";

export function SourceTree() {
  const { activeInstanceId, instances } = useEditingInstances();
  const nodes = useMemo(() => getSourceTreeNodes(instances), [instances]);
  const instancesById = useMemo(
    () => new Map<string, EditingInstance>(instances.map((instance) => [instance.id, instance])),
    [instances],
  );

  return (
    <div className="flex flex-col gap-1">
      <SourceTreeNodes instancesById={instancesById} nodes={nodes} value={activeInstanceId ?? ""} />
    </div>
  );
}
