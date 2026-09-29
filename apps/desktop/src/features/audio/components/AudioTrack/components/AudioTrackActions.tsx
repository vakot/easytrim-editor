import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { AudioStream } from "@/lib/tauri/media.types";

import type { AudioTrackController } from "../../../hooks/useAudioTrackController";

type MenuMode = "context" | "dropdown";

interface AudioTrackActionsProps {
  controller: AudioTrackController;
  mode?: MenuMode;
  onOpenEffects: () => void;
  stream: AudioStream;
  trackNumber: number;
}

function AudioTrackActions({
  controller,
  mode = "dropdown",
  onOpenEffects,
  stream,
  trackNumber,
}: AudioTrackActionsProps) {
  const { t } = useTranslation();
  const track = controller.track;
  if (!track) return null;
  const streamTitle =
    stream.title ?? stream.language ?? t("audio.labels.defaultTrack", { number: trackNumber });

  const content = (
    <>
      <TrackMenuItem
        checked={track.enabled}
        label={
          track.enabled
            ? t("audio.actions.muteTrack", { title: streamTitle })
            : t("audio.actions.unmuteTrack", { title: streamTitle })
        }
        mode={mode}
        onAction={controller.setEnabled}
      />

      <MenuSeparator mode={mode} />

      <TrackMenuItem
        disabled={track.activityAnalysis.status === "loading"}
        label={activityActionLabel(track.activityAnalysis.status, t)}
        mode={mode}
        onAction={controller.detectActivity}
      />
      {track.activityAnalysis.status === "ready" ? (
        <TrackMenuItem
          checked={track.activityVisible}
          label={
            track.activityVisible
              ? t("audio.actions.hideActivity")
              : t("audio.actions.showActivity")
          }
          mode={mode}
          onAction={controller.toggleActivityVisibility}
        />
      ) : null}

      <MenuSeparator mode={mode} />

      <TrackMenuItem label={t("audio.actions.effects")} mode={mode} onAction={onOpenEffects} />
    </>
  );

  if (mode === "context") return content;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("audio.accessibility.trackActions", { number: trackNumber })}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <MoreVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>{content}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function activityActionLabel(
  status: "idle" | "loading" | "ready" | "failed",
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (status === "loading") return t("audio.actions.detectingActivity");
  if (status === "ready") return t("audio.actions.redetectActivity");
  if (status === "failed") return t("audio.actions.retryActivityDetection");
  return t("audio.actions.detectActivity");
}

function MenuSeparator({ mode }: { mode: MenuMode }) {
  return mode === "context" ? <ContextMenuSeparator /> : <DropdownMenuSeparator />;
}

function TrackMenuItem({
  checked,
  disabled,
  label,
  mode,
  onAction,
}: {
  checked?: boolean;
  disabled?: boolean;
  label: string;
  mode: MenuMode;
  onAction: () => void;
}) {
  if (mode === "context") {
    return checked === undefined ? (
      <ContextMenuItem disabled={disabled} onSelect={onAction}>
        {label}
      </ContextMenuItem>
    ) : (
      <ContextMenuCheckboxItem checked={checked} disabled={disabled} onCheckedChange={onAction}>
        {label}
      </ContextMenuCheckboxItem>
    );
  }

  return checked === undefined ? (
    <DropdownMenuItem disabled={disabled} onSelect={onAction}>
      {label}
    </DropdownMenuItem>
  ) : (
    <DropdownMenuCheckboxItem checked={checked} disabled={disabled} onCheckedChange={onAction}>
      {label}
    </DropdownMenuCheckboxItem>
  );
}

export { AudioTrackActions };
