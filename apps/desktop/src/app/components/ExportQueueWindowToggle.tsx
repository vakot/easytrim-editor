import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/class-names.utils";

interface ExportQueueWindowToggleProps {
  active: boolean;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}

export function ExportQueueWindowToggle({
  active,
  className,
  disabled,
  onClick,
}: ExportQueueWindowToggleProps) {
  const { t } = useTranslation();

  return (
    <Button
      aria-pressed={active}
      className={cn("h-7 px-2 text-xs", className)}
      disabled={disabled}
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      {t("app.labels.exportQueue")}
    </Button>
  );
}
