import { useMemo } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstanceTopologyEntries,
} from "@/app/store/slices/editing-instances-slice";
import { cn } from "@/lib/class-names.utils";

import { SourceTreeNodes } from "./components/SourceTreeNodes";
import { getSourceTreeNodes } from "./lib/source-tree.utils";

interface SourceTreeProps {
  className?: string;
}

export function SourceTree({ className }: SourceTreeProps) {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const topologyEntries = useAppSelector(selectEditingInstanceTopologyEntries);
  const nodes = useMemo(() => getSourceTreeNodes(topologyEntries), [topologyEntries]);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <SourceTreeNodes nodes={nodes} value={activeInstanceId ?? ""} />
    </div>
  );
}
