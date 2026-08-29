import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioMergeToggled,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
  waveformDisplayFailed,
} from "@/app/store/slices/audio-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { prepareSourceWaveforms } from "@/app/store/thunks/source-media-thunks";

import { AudioTracks } from "./components/AudioTracks";

const EMPTY_TIMELINE_RANGE = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
} as const;

export function AudioPanel() {
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const audioTracks = useAppSelector(selectAudioTracks);
  const mergeAudio = useAppSelector(selectMergeAudio);
  const masterAudio = useAppSelector(selectMasterAudio);
  const playback = usePlayback();
  const timeline = useTimeline();
  const dispatch = useAppDispatch();
  const sourcePath = sourceSelection?.sourcePath ?? null;

  return (
    <AudioTracks
      masterEnabled={masterAudio.enabled}
      masterVolumePercent={masterAudio.volumePercent}
      mergeAudio={mergeAudio}
      onMasterVolumeChange={(volumePercent) => dispatch(masterVolumeChanged({ volumePercent }))}
      onPrepareWaveforms={(streamIndexes, width) =>
        sourcePath && void dispatch(prepareSourceWaveforms(sourcePath, streamIndexes, width))
      }
      onToggleMaster={() => dispatch(masterAudioToggled())}
      onToggleMerge={() => dispatch(audioMergeToggled())}
      onToggleTrack={(streamIndex) => dispatch(audioTrackToggled({ streamIndex }))}
      onTrackVolumeChange={(streamIndex, volumePercent) =>
        dispatch(audioTrackVolumeChanged({ streamIndex, volumePercent }))
      }
      onWaveformImageError={(streamIndex) => dispatch(waveformDisplayFailed({ streamIndex }))}
      playheadMicros={timeline.playheadMicros}
      playheadRef={playback.audioPlayheadRef}
      range={trim ?? EMPTY_TIMELINE_RANGE}
      streams={media?.audioStreams ?? []}
      tracks={audioTracks}
      waveformPreparationEnabled={playback.isReady}
    />
  );
}
