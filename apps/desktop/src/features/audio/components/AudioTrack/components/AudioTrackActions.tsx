import { ChevronRight, WandSparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuIcon,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Slot } from "@/components/ui/slot";

import type { AudioStream } from "@/lib/tauri/media.types";

import type { AudioTrackController } from "../../../hooks/useAudioTrackController";

import { useAudioTrackEffectsDialog } from "./AudioTrackEffectsDialog";

interface AudioTrackActionsProps {
  controller: AudioTrackController;
  stream: AudioStream;
  trackNumber: number;
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

function AudioTrackToggleMenuCheckboxItem({
  children,
  controller,
  stream,
  trackNumber,
}: { children?: React.ReactNode } & AudioTrackActionsProps) {
  const { t } = useTranslation();
  const track = controller.track!;

  const streamTitle =
    stream.title ?? stream.language ?? t("audio.labels.defaultTrack", { number: trackNumber });

  const commandProps = {
    "aria-label": track.enabled
      ? t("audio.actions.muteTrack", { title: streamTitle })
      : t("audio.actions.unmuteTrack", { title: streamTitle }),
    onCheckedChange: controller.setEnabled,
    checked: track.enabled,
  };

  return <Slot {...commandProps}>{children}</Slot>;
}

function AudioTrackToggleActivityCheckboxMenuItem({
  children,
  controller,
}: { children?: React.ReactNode } & AudioTrackActionsProps) {
  const { t } = useTranslation();
  const track = controller.track!;
  const hasActivity = track.activityAnalysis.status === "ready";

  const handleCheckedChange = () => {
    if (!hasActivity) controller.detectActivity();
    controller.toggleActivityVisibility();
  };

  const commandProps = {
    "aria-label": hasActivity
      ? track.activityVisible
        ? t("audio.actions.hideActivity")
        : t("audio.actions.showActivity")
      : activityActionLabel(track.activityAnalysis.status, t),
    onCheckedChange: handleCheckedChange,
    checked: hasActivity && track.activityVisible,
    disabled: track.activityAnalysis.status === "loading",
  };

  return <Slot {...commandProps}>{children}</Slot>;
}

function AudioTrackEffectsMenuItem({
  children,
}: { children?: React.ReactNode } & AudioTrackActionsProps) {
  const { t } = useTranslation();
  const { openEffects } = useAudioTrackEffectsDialog();

  const commandProps = {
    "aria-label": t("audio.actions.effects"),
    onSelect: openEffects,
  };

  return <Slot {...commandProps}>{children}</Slot>;
}

function AudioTrackDropdownMenuContent({
  controller,
  stream,
  trackNumber,
}: AudioTrackActionsProps) {
  return (
    <DropdownMenuContent>
      <AudioTrackToggleMenuCheckboxItem
        controller={controller}
        stream={stream}
        trackNumber={trackNumber}
      >
        <DropdownMenuCheckboxItem keepOpen>Enabled</DropdownMenuCheckboxItem>
      </AudioTrackToggleMenuCheckboxItem>

      <DropdownMenuSeparator />

      <AudioTrackToggleActivityCheckboxMenuItem
        controller={controller}
        stream={stream}
        trackNumber={trackNumber}
      >
        <DropdownMenuCheckboxItem keepOpen>Show Activity</DropdownMenuCheckboxItem>
      </AudioTrackToggleActivityCheckboxMenuItem>

      <DropdownMenuSeparator />

      <AudioTrackEffectsMenuItem controller={controller} stream={stream} trackNumber={trackNumber}>
        <DropdownMenuItem inset>
          <DropdownMenuIcon side="left">
            <WandSparkles />
          </DropdownMenuIcon>
          Effects
          <DropdownMenuIcon side="right">
            <ChevronRight />
          </DropdownMenuIcon>
        </DropdownMenuItem>
      </AudioTrackEffectsMenuItem>
    </DropdownMenuContent>
  );
}

function AudioTrackContextMenuContent({ controller, stream, trackNumber }: AudioTrackActionsProps) {
  return (
    <ContextMenuContent>
      <AudioTrackToggleMenuCheckboxItem
        controller={controller}
        stream={stream}
        trackNumber={trackNumber}
      >
        <ContextMenuCheckboxItem keepOpen>Toggle</ContextMenuCheckboxItem>
      </AudioTrackToggleMenuCheckboxItem>

      <ContextMenuSeparator />

      <AudioTrackToggleActivityCheckboxMenuItem
        controller={controller}
        stream={stream}
        trackNumber={trackNumber}
      >
        <ContextMenuCheckboxItem keepOpen>Show Activity</ContextMenuCheckboxItem>
      </AudioTrackToggleActivityCheckboxMenuItem>

      <ContextMenuSeparator />

      <AudioTrackEffectsMenuItem controller={controller} stream={stream} trackNumber={trackNumber}>
        <ContextMenuItem inset>
          <ContextMenuIcon side="left">
            <WandSparkles />
          </ContextMenuIcon>
          Effects
          <ContextMenuIcon side="right">
            <ChevronRight />
          </ContextMenuIcon>
        </ContextMenuItem>
      </AudioTrackEffectsMenuItem>
    </ContextMenuContent>
  );
}

export { AudioTrackContextMenuContent, AudioTrackDropdownMenuContent };
