import { Volume2, VolumeX } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";

type VolumeButtonProps = Omit<
  ComponentPropsWithoutRef<typeof Button>,
  "aria-label" | "children" | "onClick"
> & {
  enabled: boolean;
  onClick: () => void;
  tooltipText?: string;
};

const VolumeButton = forwardRef<HTMLButtonElement, VolumeButtonProps>(function VolumeButton(
  { className, enabled, tooltipText, ...buttonProps },
  ref,
) {
  const { t } = useTranslation();
  const defaultTooltipText = enabled ? t("audio.actions.mute") : t("audio.actions.unmute");

  return (
    <Tooltip preserveOnTrigger>
      <TooltipTrigger asChild>
        <Button
          aria-pressed={enabled}
          className={cn("text-primary", className)}
          ref={ref}
          size="icon-sm"
          type="button"
          variant="ghost"
          {...buttonProps}
        >
          {enabled ? <Volume2 /> : <VolumeX />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltipText ?? defaultTooltipText}</TooltipContent>
    </Tooltip>
  );
});

export { VolumeButton };
