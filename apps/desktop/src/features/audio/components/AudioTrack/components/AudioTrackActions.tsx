import { ChevronRight, MoreVertical, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuIcon,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slot } from "@/components/ui/slot";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("audio.waveform.displayMode.label")}</DropdownMenuLabel>
        <AudioTrackDisplayModeMenuRadioGroup>
          <DropdownMenuRadioGroup>
            {WAVEFORM_DISPLAY_MODES.map((mode) => (
              <DropdownMenuRadioItem inset keepOpen key={mode} value={mode}>
                {waveformDisplayModeLabel(mode, t)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </AudioTrackDisplayModeMenuRadioGroup>
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

      <ContextMenuGroup>
        <ContextMenuLabel>{t("audio.waveform.displayMode.label")}</ContextMenuLabel>
        <AudioTrackDisplayModeMenuRadioGroup>
          <ContextMenuRadioGroup>
            {WAVEFORM_DISPLAY_MODES.map((mode) => (
              <ContextMenuRadioItem inset keepOpen key={mode} value={mode}>
                {waveformDisplayModeLabel(mode, t)}
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
        </AudioTrackDisplayModeMenuRadioGroup>
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
