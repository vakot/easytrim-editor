import { Volume2, VolumeX } from "lucide-react";
import { forwardRef } from "react";
import type { FocusEventHandler, PointerEventHandler } from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface VolumeButtonProps {
  enabled: boolean;
  label: string;
  onClick: () => void;
  onPointerEnter?: PointerEventHandler<HTMLButtonElement>;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
}

export const VolumeButton = forwardRef<HTMLButtonElement, VolumeButtonProps>(function VolumeButton(
  { enabled, label, onClick, onPointerEnter, onFocus },
  ref,
) {
  const { t } = useTranslation();

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label={label}
      aria-pressed={enabled}
      title={t(enabled ? "audio.enabledState" : "audio.mutedState", { label })}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
      className="text-primary"
    >
      {enabled ? <Volume2 /> : <VolumeX />}
    </Button>
  );
});
