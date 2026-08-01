import { Volume2, VolumeX } from "lucide-react";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const stateLabel = t(enabled ? "audio.enabledState" : "audio.mutedState", { label });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          {...buttonProps}
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={label}
          aria-pressed={enabled}
          onClick={onClick}
          className={cn("text-primary", className)}
        >
          {enabled ? <Volume2 /> : <VolumeX />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{stateLabel}</TooltipContent>
    </Tooltip>
  );
});
