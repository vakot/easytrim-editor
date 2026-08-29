import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SquareArrowLeft,
  SquareArrowRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { TrimBoundary } from "@/domain/trim";

interface PlaybackControlsProps {
  canSetSegmentEnd: boolean;
  canSetSegmentStart: boolean;
  disabled?: boolean;
  error: string | null;
  isPlaying: boolean;
  onSetSegmentBoundary: (boundary: TrimBoundary) => void;
  onStepFrame: (direction: -1 | 1) => void;
  onTogglePlayback: () => void;
}

export function PlaybackControls({
  canSetSegmentEnd,
  canSetSegmentStart,
  disabled = false,
  error,
  isPlaying,
  onSetSegmentBoundary,
  onStepFrame,
  onTogglePlayback,
}: PlaybackControlsProps) {
  const { t } = useTranslation();

  return (
    <div aria-label={t("preview.controls")} className="relative flex items-center justify-center">
      <div className="flex items-center gap-1.5">
        <TransportButton
          disabled={disabled || !canSetSegmentStart}
          label={t("preview.setStart")}
          onClick={() => onSetSegmentBoundary("start")}
          shortcut="I"
          title={
            canSetSegmentStart ? t("preview.setStartShortcut") : t("preview.setStartUnavailable")
          }
        >
          <SquareArrowRight />
        </TransportButton>
        <TransportButton
          disabled={disabled}
          label={t("preview.previousFrame")}
          onClick={() => onStepFrame(-1)}
          shortcut="ArrowLeft"
          title={t("preview.previousFrameShortcut")}
        >
          <SkipBack />
        </TransportButton>
        <TransportButton
          disabled={disabled}
          label={isPlaying ? t("preview.pause") : t("preview.play")}
          onClick={onTogglePlayback}
          primary
          shortcut="Space"
          title={isPlaying ? t("preview.pauseShortcut") : t("preview.playShortcut")}
        >
          {isPlaying ? <Pause /> : <Play />}
        </TransportButton>
        <TransportButton
          disabled={disabled}
          label={t("preview.nextFrame")}
          onClick={() => onStepFrame(1)}
          shortcut="ArrowRight"
          title={t("preview.nextFrameShortcut")}
        >
          <SkipForward />
        </TransportButton>
        <TransportButton
          disabled={disabled || !canSetSegmentEnd}
          label={t("preview.setEnd")}
          onClick={() => onSetSegmentBoundary("end")}
          shortcut="O"
          title={canSetSegmentEnd ? t("preview.setEndShortcut") : t("preview.setEndUnavailable")}
        >
          <SquareArrowLeft />
        </TransportButton>
      </div>
      {error ? (
        <Alert className="absolute top-full z-10 mt-2 w-72" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function TransportButton({
  children,
  disabled,
  label,
  onClick,
  primary = false,
  shortcut,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  primary?: boolean;
  shortcut: string;
  title: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-keyshortcuts={shortcut}
          aria-label={label}
          className={primary ? "rounded-full" : undefined}
          data-editor-shortcut="true"
          disabled={disabled}
          onClick={onClick}
          size={primary ? "icon-lg" : "icon-sm"}
          type="button"
          variant={primary ? "default" : "ghost"}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
