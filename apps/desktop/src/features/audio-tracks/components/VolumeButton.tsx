import { Volume2, VolumeX } from "lucide-react";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type VolumeButtonProps = Omit<
  ComponentPropsWithoutRef<typeof Button>,
  "aria-label" | "children" | "onClick"
> & {
  enabled: boolean;
  label: string;
  onClick: () => void;
};

export const VolumeButton = forwardRef<HTMLButtonElement, VolumeButtonProps>(function VolumeButton(
  { className, enabled, label, onClick, ...buttonProps },
  ref,
) {
  const { t } = useTranslation();

  return (
    <Button
      ref={ref}
      {...buttonProps}
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label={label}
      aria-pressed={enabled}
      title={t(enabled ? "audio.enabledState" : "audio.mutedState", { label })}
      onClick={onClick}
      className={cn("text-primary", className)}
    >
      {enabled ? <Volume2 /> : <VolumeX />}
    </Button>
  );
});
