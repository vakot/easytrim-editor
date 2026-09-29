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

import type { AudioTrackController } from "../../../hooks/useAudioTrackController";

import { useAudioTrackEffectsDialog } from "./audio-track-effects-dialog-context";

interface AudioTrackActionsProps {
  controller: AudioTrackController;
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
}: { children?: React.ReactNode } & AudioTrackActionsProps) {
  const { t } = useTranslation();
  const { stream, track, trackNumber } = controller;
  if (!track || !stream) return null;

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
  const track = controller.track;
  if (!track) return null;
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

function AudioTrackDropdownMenuContent({ controller }: AudioTrackActionsProps) {
  return (
    <DropdownMenuContent>
      <AudioTrackToggleMenuCheckboxItem controller={controller}>
        <DropdownMenuCheckboxItem keepOpen>Enabled</DropdownMenuCheckboxItem>
      </AudioTrackToggleMenuCheckboxItem>

      <DropdownMenuSeparator />

      <AudioTrackToggleActivityCheckboxMenuItem controller={controller}>
        <DropdownMenuCheckboxItem keepOpen>Show Activity</DropdownMenuCheckboxItem>
      </AudioTrackToggleActivityCheckboxMenuItem>

      <DropdownMenuSeparator />

      <AudioTrackEffectsMenuItem controller={controller}>
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

function AudioTrackContextMenuContent({ controller }: AudioTrackActionsProps) {
  return (
    <ContextMenuContent>
      <AudioTrackToggleMenuCheckboxItem controller={controller}>
        <ContextMenuCheckboxItem keepOpen>Toggle</ContextMenuCheckboxItem>
      </AudioTrackToggleMenuCheckboxItem>

      <ContextMenuSeparator />

      <AudioTrackToggleActivityCheckboxMenuItem controller={controller}>
        <ContextMenuCheckboxItem keepOpen>Show Activity</ContextMenuCheckboxItem>
      </AudioTrackToggleActivityCheckboxMenuItem>

      <ContextMenuSeparator />

      <AudioTrackEffectsMenuItem controller={controller}>
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
