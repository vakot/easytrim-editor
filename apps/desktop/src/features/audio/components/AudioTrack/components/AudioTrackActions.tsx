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

import { useAudioTrackEffectsDialog } from "./AudioTrackEffectsDialog/contexts/audio-track-effects-dialog-context";

interface AudioTrackActionsProps {
  controller: AudioTrackController;
}

function activityActionLabel(
  status: "idle" | "loading" | "ready" | "failed",
  visible: boolean,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (status === "ready") {
    return visible ? t("audio.actions.hideActivity") : t("audio.actions.showActivity");
  }
  if (status === "loading") return t("audio.actions.detectingActivity");
  if (status === "failed") return t("audio.actions.retryActivityDetection");
  return t("audio.actions.detectActivity");
}

function AudioTrackRedetectActivityMenuItem({
  children,
  controller,
}: { children?: React.ReactNode } & AudioTrackActionsProps) {
  const track = controller.track;
  if (!track || track.activityAnalysis.status !== "ready" || !children) return null;

  return <Slot onSelect={controller.detectActivity}>{children}</Slot>;
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
    "aria-label": controller.isEnabled
      ? t("audio.actions.muteTrack", { title: streamTitle })
      : t("audio.actions.unmuteTrack", { title: streamTitle }),
    onCheckedChange: controller.setEnabled,
    checked: controller.isEnabled,
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
  const streamTitle =
    stream.title ?? stream.language ?? t("audio.labels.defaultTrack", { number: trackNumber });

  const hasActivity = track.activityAnalysis.status === "ready";
  const label = hasActivity
    ? track.activityVisible
      ? t("audio.actions.hideActivity")
      : t("audio.actions.showActivity")
    : activityActionLabel(track.activityAnalysis.status, t);

  const commandProps = {
    "aria-label": activityActionLabel(track.activityAnalysis.status, track.activityVisible, t),
    checked: hasActivity && track.activityVisible,
    onCheckedChange: hasActivity ? controller.toggleActivityVisibility : controller.detectActivity,
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
  const { t } = useTranslation();
  const track = controller.track;

  return (
    <DropdownMenuContent>
      <AudioTrackToggleMenuCheckboxItem controller={controller}>
        <DropdownMenuCheckboxItem keepOpen>Enabled</DropdownMenuCheckboxItem>
      </AudioTrackToggleMenuCheckboxItem>

      <DropdownMenuSeparator />

      <AudioTrackToggleActivityCheckboxMenuItem controller={controller}>
        <DropdownMenuCheckboxItem keepOpen>
          {activityActionLabel(
            track?.activityAnalysis.status || "idle",
            track?.activityVisible ?? false,
            t,
          )}
        </DropdownMenuCheckboxItem>
      </AudioTrackToggleActivityCheckboxMenuItem>

      {track?.activityAnalysis.status === "ready" ? (
        <AudioTrackRedetectActivityMenuItem controller={controller}>
          <DropdownMenuItem inset>{t("audio.actions.redetectActivity")}</DropdownMenuItem>
        </AudioTrackRedetectActivityMenuItem>
      ) : null}

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
  const { t } = useTranslation();
  const track = controller.track;

  return (
    <ContextMenuContent>
      <AudioTrackToggleMenuCheckboxItem controller={controller}>
        <ContextMenuCheckboxItem keepOpen>Toggle</ContextMenuCheckboxItem>
      </AudioTrackToggleMenuCheckboxItem>

      <ContextMenuSeparator />

      <AudioTrackToggleActivityCheckboxMenuItem controller={controller}>
        <ContextMenuCheckboxItem keepOpen>
          {activityActionLabel(
            track?.activityAnalysis.status || "idle",
            track?.activityVisible ?? false,
            t,
          )}
        </ContextMenuCheckboxItem>
      </AudioTrackToggleActivityCheckboxMenuItem>

      {track?.activityAnalysis.status === "ready" ? (
        <AudioTrackRedetectActivityMenuItem controller={controller}>
          <ContextMenuItem inset>{t("audio.actions.redetectActivity")}</ContextMenuItem>
        </AudioTrackRedetectActivityMenuItem>
      ) : null}

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
