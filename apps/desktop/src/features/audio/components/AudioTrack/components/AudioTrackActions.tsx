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
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (status === "ready") return t("audio.actions.showActivity");
  if (status === "loading") return t("audio.actions.analyzingActivity");
  if (status === "failed") return t("audio.actions.retryActivityDetection");
  return t("audio.actions.analyzeActivity");
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

  const hasActivity = track.activityAnalysis.status === "ready";
  const label = activityActionLabel(track.activityAnalysis.status, t);

  const commandProps = {
    "aria-label": label,
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
        <DropdownMenuCheckboxItem keepOpen>{t("common.status.enabled")}</DropdownMenuCheckboxItem>
      </AudioTrackToggleMenuCheckboxItem>

      <DropdownMenuSeparator />

      <AudioTrackToggleActivityCheckboxMenuItem controller={controller}>
        <DropdownMenuCheckboxItem keepOpen>
          {activityActionLabel(track?.activityAnalysis.status || "idle", t)}
        </DropdownMenuCheckboxItem>
      </AudioTrackToggleActivityCheckboxMenuItem>

      <DropdownMenuSeparator />

      <AudioTrackEffectsMenuItem controller={controller}>
        <DropdownMenuItem inset>
          <DropdownMenuIcon side="left">
            <WandSparkles />
          </DropdownMenuIcon>
          {t("audio.actions.effects")}
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
        <ContextMenuCheckboxItem keepOpen>{t("common.status.enabled")}</ContextMenuCheckboxItem>
      </AudioTrackToggleMenuCheckboxItem>

      <ContextMenuSeparator />

      <AudioTrackToggleActivityCheckboxMenuItem controller={controller}>
        <ContextMenuCheckboxItem keepOpen>
          {activityActionLabel(track?.activityAnalysis.status || "idle", t)}
        </ContextMenuCheckboxItem>
      </AudioTrackToggleActivityCheckboxMenuItem>

      <ContextMenuSeparator />

      <AudioTrackEffectsMenuItem controller={controller}>
        <ContextMenuItem inset>
          <ContextMenuIcon side="left">
            <WandSparkles />
          </ContextMenuIcon>
          {t("audio.actions.effects")}
          <ContextMenuIcon side="right">
            <ChevronRight />
          </ContextMenuIcon>
        </ContextMenuItem>
      </AudioTrackEffectsMenuItem>
    </ContextMenuContent>
  );
}

export { AudioTrackContextMenuContent, AudioTrackDropdownMenuContent };
