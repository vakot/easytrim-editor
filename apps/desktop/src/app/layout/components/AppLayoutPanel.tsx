import { Card } from "@/components/ui/card";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectLayoutDensity } from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";

interface AppLayoutPanelProps {
  children?: React.ReactNode;
  className?: string;
  layoutRegion?: string;
}

function AppLayoutPanel({ children, className, layoutRegion }: AppLayoutPanelProps) {
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const isCompact = layoutDensity === "compact";

  return (
    <Card
      className={cn(
        "size-full min-h-0 min-w-0 gap-0 border border-border p-0 ring-0",
        isCompact && "rounded-none bg-card",
        className,
      )}
      data-layout-region={layoutRegion}
    >
      {children}
    </Card>
  );
}

export { AppLayoutPanel };
