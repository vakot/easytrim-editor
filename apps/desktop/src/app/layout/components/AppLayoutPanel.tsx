import { Card } from "@/components/ui/card";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectLayoutDensity } from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";

interface AppLayoutPanelProps {
  children?: React.ReactNode;
  className?: string;
}

function AppLayoutPanel({ children, className }: AppLayoutPanelProps) {
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const isCompact = layoutDensity === "compact";

  return (
    <Card
      className={cn(
        "size-full gap-0 border border-border p-0 ring-0",
        isCompact && "block rounded-none border-0 bg-card",
        className,
      )}
    >
      {children}
    </Card>
  );
}

export { AppLayoutPanel };
