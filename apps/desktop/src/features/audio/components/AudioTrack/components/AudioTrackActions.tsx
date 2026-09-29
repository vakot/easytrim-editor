import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { useAppDispatch } from "@/app/store/redux-hooks";
import {
  type AudioTrackState,
  audioTrackToggled,
  audioTrackVolumeChanged,
} from "@/app/store/slices/audio-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { diagnostics } from "@/lib/diagnostics";
import type { AudioStream } from "@/lib/tauri/media.types";

interface AudioTrackToggleProps {
  stream: AudioStream;
  track: AudioTrackState;
}

function AudioTrackActions({ stream, track }: AudioTrackToggleProps) {
  const dispatch = useAppDispatch();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button size="icon-sm" variant="ghost">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={track.enabled}
          keepOpen
          onCheckedChange={() => {
            diagnostics.action(
              "audio.track.toggle.requested",
              { type: "button", id: "track-toggle" },
              { streamIndex: stream.streamIndex },
            );
            dispatch(audioTrackToggled(stream));
            dispatch(commitActiveEditingInstanceDraft());
          }}
        >
          Toggle
        </DropdownMenuCheckboxItem>

        <DropdownMenuItem asChild keepOpen>
          <Input
            onChange={(e) => {
              const options = { streamIndex: stream.streamIndex, volumePercent: e.target.value };
              diagnostics.action(
                "audio.track.volume.requested",
                { type: "button", id: "track-volume" },
                options,
              );
              dispatch(audioTrackVolumeChanged(options));
            }}
            type="number"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AudioTrackActions };
