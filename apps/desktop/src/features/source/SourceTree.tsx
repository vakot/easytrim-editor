import { SourceTreeNodes } from "./components/SourceTreeNodes";
import { useEditingInstances } from "./hooks/useEditingInstances";
import { getSourceTreeNodes } from "./lib/source-tree.utils";

export function SourceTree() {
  const { activeInstanceId, instances } = useEditingInstances();

  return (
    <div className="flex flex-col gap-1">
      <SourceTreeNodes nodes={getSourceTreeNodes(instances)} value={activeInstanceId ?? ""} />
    </div>
  );
}
