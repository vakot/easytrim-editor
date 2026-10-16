import { AudioLines, ChevronRight, MoreVertical, Pencil, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuIcon,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slot } from "@/components/ui/slot";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { AudioTrackFiltersDialogTrigger } from "../../../dialogs/AudioTrackFiltersDialog";
import { AudioTrackMetadataDialogTrigger } from "../../../dialogs/AudioTrackMetadataDialog";
import { useAudioTrackController } from "../../../hooks/useAudioTrackController";
import {
  isWaveformDisplayMode,
  WAVEFORM_DISPLAY_MODES,
  waveformDisplayModeLabel,
} from "../../../lib/waveform-display-mode";
import { useAudioTrackDisplayMode } from "../contexts/audio-track-display-mode-context";

interface AudioTrackActionsProps {
  streamIndex: number;
}

function AudioTrackActions({ streamIndex }: AudioTrackActionsProps) {
  const { t } = useTranslation();
  const { trackNumber } = useAudioTrackController(streamIndex);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("audio.tracks.actionsLabel", { number: trackNumber })}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <MoreVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <AudioTrackDropdownMenuContent streamIndex={streamIndex} />
    </DropdownMenu>
  );
}

function AudioTrackDropdownMenuContent({ streamIndex }: AudioTrackActionsProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenuContent>
      <AudioTrackToggleMenuCheckboxItem streamIndex={streamIndex}>
        <DropdownMenuCheckboxItem keepOpen>{t("common.actions.enable")}</DropdownMenuCheckboxItem>
      </AudioTrackToggleMenuCheckboxItem>

      <DropdownMenuSeparator />

      <AudioTrackActivityMenuCheckboxItem streamIndex={streamIndex}>
        <DropdownMenuCheckboxItem keepOpen>
          <AudioTrackActivityLabel streamIndex={streamIndex} />
        </DropdownMenuCheckboxItem>
      </AudioTrackActivityMenuCheckboxItem>

      <DropdownMenuSeparator />

      <AudioTrackDefaultMenuCheckboxItem streamIndex={streamIndex}>
        <DropdownMenuCheckboxItem keepOpen>
          {t("audio.tracks.metadata.fields.default.label")}
        </DropdownMenuCheckboxItem>
      </AudioTrackDefaultMenuCheckboxItem>

      <AudioTrackMetadataDialogTrigger asChild>
        <DropdownMenuItem inset>
          <DropdownMenuIcon side="left">
            <Pencil />
          </DropdownMenuIcon>
          {t("audio.tracks.metadata.actions.edit")}
          <DropdownMenuIcon side="right">
            <ChevronRight />
          </DropdownMenuIcon>
        </DropdownMenuItem>
      </AudioTrackMetadataDialogTrigger>

      <DropdownMenuSeparator />

      <AudioTrackFiltersDialogTrigger asChild>
        <DropdownMenuItem inset>
          <DropdownMenuIcon side="left">
            <SlidersHorizontal />
          </DropdownMenuIcon>
          {t("audio.filters.actions.open")}
          <DropdownMenuIcon side="right">
            <ChevronRight />
          </DropdownMenuIcon>
        </DropdownMenuItem>
      </AudioTrackFiltersDialogTrigger>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger inset>
            <DropdownMenuIcon>
              <AudioLines aria-hidden="true" />
            </DropdownMenuIcon>
            {t("audio.waveform.displayMode.label")}
          </DropdownMenuSubTrigger>

          <DropdownMenuSubContent>
            <AudioTrackDisplayModeMenuRadioGroup>
              <DropdownMenuRadioGroup>
                {WAVEFORM_DISPLAY_MODES.map((mode) => (
                  <DropdownMenuRadioItem inset keepOpen key={mode} value={mode}>
                    {waveformDisplayModeLabel(mode, t)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </AudioTrackDisplayModeMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
}

function AudioTrackContextMenuContent({ streamIndex }: AudioTrackActionsProps) {
  const { t } = useTranslation();

  return (
    <ContextMenuContent>
      <AudioTrackToggleMenuCheckboxItem streamIndex={streamIndex}>
        <ContextMenuCheckboxItem keepOpen>{t("common.actions.enable")}</ContextMenuCheckboxItem>
      </AudioTrackToggleMenuCheckboxItem>

      <ContextMenuSeparator />

      <AudioTrackActivityMenuCheckboxItem streamIndex={streamIndex}>
        <ContextMenuCheckboxItem keepOpen>
          <AudioTrackActivityLabel streamIndex={streamIndex} />
        </ContextMenuCheckboxItem>
      </AudioTrackActivityMenuCheckboxItem>

      <ContextMenuSeparator />

      <AudioTrackDefaultMenuCheckboxItem streamIndex={streamIndex}>
        <ContextMenuCheckboxItem keepOpen>
          {t("audio.tracks.metadata.fields.default.label")}
        </ContextMenuCheckboxItem>
      </AudioTrackDefaultMenuCheckboxItem>

      <AudioTrackMetadataDialogTrigger asChild>
        <ContextMenuItem inset>
          <ContextMenuIcon side="left">
            <Pencil />
          </ContextMenuIcon>
          {t("audio.tracks.metadata.actions.edit")}
          <ContextMenuIcon side="right">
            <ChevronRight />
          </ContextMenuIcon>
        </ContextMenuItem>
      </AudioTrackMetadataDialogTrigger>

      <ContextMenuSeparator />

      <AudioTrackFiltersDialogTrigger asChild>
        <ContextMenuItem inset>
          <ContextMenuIcon side="left">
            <SlidersHorizontal />
          </ContextMenuIcon>
          {t("audio.filters.actions.open")}
          <ContextMenuIcon side="right">
            <ChevronRight />
          </ContextMenuIcon>
        </ContextMenuItem>
      </AudioTrackFiltersDialogTrigger>

      <ContextMenuSeparator />

      <ContextMenuGroup>
        <ContextMenuSub>
          <ContextMenuSubTrigger inset>
            <ContextMenuIcon>
              <AudioLines aria-hidden="true" />
            </ContextMenuIcon>
            {t("audio.waveform.displayMode.label")}
          </ContextMenuSubTrigger>

          <ContextMenuSubContent>
            <AudioTrackDisplayModeMenuRadioGroup>
              <ContextMenuRadioGroup>
                {WAVEFORM_DISPLAY_MODES.map((mode) => (
                  <ContextMenuRadioItem inset keepOpen key={mode} value={mode}>
                    {waveformDisplayModeLabel(mode, t)}
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </AudioTrackDisplayModeMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuGroup>
    </ContextMenuContent>
  );
}

function AudioTrackToggleMenuCheckboxItem({
  children,
  streamIndex,
}: { children?: ReactNode } & AudioTrackActionsProps) {
  const { isEnabled, setEnabled, track } = useAudioTrackController(streamIndex);
  if (!track) return null;

  // Slot forwards the checkbox item props to the menu-specific item it wraps.
  const commandProps = { checked: isEnabled, onCheckedChange: setEnabled };

  return <Slot {...commandProps}>{children}</Slot>;
}

function AudioTrackActivityMenuCheckboxItem({
  children,
  streamIndex,
}: { children?: ReactNode } & AudioTrackActionsProps) {
  const { detectActivity, toggleActivityVisibility, track } = useAudioTrackController(streamIndex);
  if (!track) return null;

  const { status } = track.activityAnalysis;
  const hasActivity = status === "ready";

  const commandProps = {
    checked: hasActivity && track.activityVisible,
    disabled: status === "loading",
    onCheckedChange: hasActivity ? toggleActivityVisibility : detectActivity,
  };

  return <Slot {...commandProps}>{children}</Slot>;
}

function AudioTrackActivityLabel({ streamIndex }: AudioTrackActionsProps) {
  const { t } = useTranslation();
  const { track } = useAudioTrackController(streamIndex);
  const status = track?.activityAnalysis.status ?? "idle";

  if (status === "ready") return t("audio.activityDetection.showRanges");
  if (status === "loading") return t("audio.activityDetection.analyzing");
  if (status === "failed") return t("audio.activityDetection.retry");
  return t("audio.activityDetection.analyze");
}

function AudioTrackDisplayModeMenuRadioGroup({ children }: { children?: ReactNode }) {
  const { displayMode, setDisplayMode } = useAudioTrackDisplayMode();
  const commandProps = {
    onValueChange: (value: string) => {
      if (isWaveformDisplayMode(value)) setDisplayMode(value);
    },
    value: displayMode,
  };

  return <Slot {...commandProps}>{children}</Slot>;
}

function AudioTrackDefaultMenuCheckboxItem({
  children,
  streamIndex,
}: { children?: ReactNode } & AudioTrackActionsProps) {
  const { t } = useTranslation();
  const { setDefault, track } = useAudioTrackController(streamIndex);
  if (!track) return null;

  const commandProps = {
    checked: track.metadata.isDefault ?? false,
    disabled: !track.enabled,
    onCheckedChange: setDefault,
  };

  const menuItem = <Slot {...commandProps}>{children}</Slot>;

  if (track.enabled) return menuItem;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">{menuItem}</span>
      </TooltipTrigger>
      <TooltipContent side="right">
        {t("audio.tracks.metadata.fields.default.disabledTooltip")}
      </TooltipContent>
    </Tooltip>
  );
}

export { AudioTrackActions, AudioTrackContextMenuContent };
