import { Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";

interface VolumeButtonProps {
  enabled: boolean;
  label: string;
  onClick: () => void;
}

export function VolumeButton({ enabled, label, onClick }: VolumeButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label={label}
      aria-pressed={enabled}
      title={enabled ? `${label}: enabled` : `${label}: muted`}
      onClick={onClick}
      className="text-primary"
    >
      {enabled ? <Volume2 /> : <VolumeX />}
    </Button>
  );
}
