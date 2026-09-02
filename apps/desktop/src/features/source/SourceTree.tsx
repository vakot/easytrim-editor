import { useMemo } from "react";

import type { EditingInstance } from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";

import { SourceTreeNodes } from "./components/SourceTreeNodes";
import { useEditingInstances } from "./hooks/useEditingInstances";
import { getSourceTreeNodes } from "./lib/source-tree.utils";

interface SourceTreeProps {
  className?: string;
}

export function SourceTree({ className }: SourceTreeProps) {
  const { activeInstanceId, instances } = useEditingInstances();
  const nodes = useMemo(() => getSourceTreeNodes(instances), [instances]);
  const instancesById = useMemo(
    () => new Map<string, EditingInstance>(instances.map((instance) => [instance.id, instance])),
    [instances],
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <SourceTreeNodes instancesById={instancesById} nodes={nodes} value={activeInstanceId ?? ""} />
    </div>
  );
}
