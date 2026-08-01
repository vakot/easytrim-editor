import { Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface VolumeButtonProps {
  enabled: boolean;
  label: string;
  onClick: () => void;
}

export function VolumeButton({ enabled, label, onClick }: VolumeButtonProps) {
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label={label}
      aria-pressed={enabled}
      title={t(enabled ? "audio.enabledState" : "audio.mutedState", { label })}
      onClick={onClick}
      className="text-primary"
    >
      {enabled ? <Volume2 /> : <VolumeX />}
    </Button>
  );
}
