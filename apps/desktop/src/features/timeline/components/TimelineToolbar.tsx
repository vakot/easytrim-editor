import { BetweenVerticalStart, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";

import { StereoAudioMeter } from "./StereoAudioMeter";

function TimelineToolbar() {
  return (
    <div
      aria-labelledby="timeline-tools-title"
      className="flex h-15 items-stretch gap-1"
      data-slot="timeline-toolbar"
      role="group"
    >
      <LoopPlaybackTool />
      <SegmentPlaybackTool />

      <Card className="min-w-0 flex-1 gap-0 rounded-md border border-border bg-muted p-0 ring-0">
        <CardContent className="flex h-full flex-col p-1">
          <StereoAudioMeter />
        </CardContent>
      </Card>
    </div>
  );
}

function LoopPlaybackTool() {
  const { t } = useTranslation();
  const enabled = useAppSelector(selectLoopPlaybackEnabled);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={enabled}
      label={t("preview.playback.loopPlayback")}
      onClick={() => dispatch(preferenceChanged({ key: "loopPlaybackEnabled", enabled: !enabled }))}
      title={
        enabled
          ? t("preview.playback.loopEnabledTooltip")
          : t("preview.playback.loopDisabledTooltip")
      }
    >
      <Repeat />
    </TimelineToolButton>
  );
}

function SegmentPlaybackTool() {
  const { t } = useTranslation();
  const enabled = useAppSelector(selectSegmentPlaybackEnabled);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={enabled}
      label={t("preview.playback.segmentPlayback")}
      onClick={() =>
        dispatch(preferenceChanged({ key: "segmentPlaybackEnabled", enabled: !enabled }))
      }
      title={
        enabled
          ? t("preview.segment.segmentEnabledTooltip")
          : t("preview.segment.segmentDisabledTooltip")
      }
    >
      <BetweenVerticalStart />
    </TimelineToolButton>
  );
}

function TimelineToolButton({
  children,
  enabled,
  label,
  onClick,
  title,
}: {
  children: React.ReactNode;
  enabled: boolean;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <Tooltip preserveOnTrigger>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={enabled}
          className={cn(enabled && "text-primary")}
          onClick={onClick}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

export { TimelineToolbar };
