import { Volume2, VolumeX } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";

type VolumeButtonProps = Omit<
  ComponentPropsWithoutRef<typeof Toggle>,
  "aria-label" | "children" | "onPressedChange"
> & {
  enabled: boolean;
  label: string;
  onPressedChange: () => void;
};

export const VolumeButton = forwardRef<HTMLButtonElement, VolumeButtonProps>(function VolumeButton(
  { className, enabled, label, onPressedChange, ...toggleProps },
  ref,
) {
  const { t } = useTranslation();
  const tooltipLabel = enabled ? t("audio.actions.mute") : t("audio.actions.unmute");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          ref={ref}
          {...toggleProps}
          aria-label={label}
          className={cn("size-7 p-0 text-primary", className)}
          data-size="icon-sm"
          onPressedChange={onPressedChange}
          pressed={enabled}
          size="sm"
        >
          {enabled ? <Volume2 /> : <VolumeX />}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
});
