import { CornerDownLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

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
      aria-label={t("app.labels.exportQueue")}
      aria-pressed={active}
      className={className}
      disabled={disabled}
      onClick={onClick}
      size="icon-sm"
      title={t("app.labels.exportQueue")}
      type="button"
      variant="ghost"
    >
      <CornerDownLeft aria-hidden="true" />
    </Button>
  );
}
