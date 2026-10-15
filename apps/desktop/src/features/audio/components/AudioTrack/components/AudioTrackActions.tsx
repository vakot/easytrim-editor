import { ChevronRight, MoreVertical, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuIcon,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slot } from "@/components/ui/slot";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { AudioTrackMetadataDialogTrigger } from "../../../dialogs/AudioTrackMetadataDialog";
import { useAudioTrackController } from "../../../hooks/useAudioTrackController";

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
