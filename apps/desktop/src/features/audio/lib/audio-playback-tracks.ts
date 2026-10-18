import type { AudioFilterPreviewState, AudioTrackState } from "@/app/store/slices/audio-slice";
import {
  activeAudioFilters,
  type AudioChainSelection,
  type AudioFilter,
  audioFiltersRequireLoudnessAnalysis,
  effectiveAudioOffsetMicros,
  sameAudioFilters,
} from "@/domain/audio-processing";
import type { AudioStream } from "@/domain/media";

import type { WebAudioTrack } from "./web-audio-engine";

/** The processing a track plays, and the chain that was requested when it was resolved. */
interface AudioPlaybackChain {
  requested: AudioFilter[];
  track: WebAudioTrack;
}

interface AudioPlaybackTracks {
  /** Every stream's chain, to resolve the next state against. */
  chains: Map<number, AudioPlaybackChain>;
  /** Whether every enabled track has processing that can play. */
  ready: boolean;
  tracks: WebAudioTrack[];
}

/**
 * Chooses the processing playback renders for each enabled track: the previewed draft for the
 * track whose filters are being edited, otherwise the committed chain. Track Volume stays out of
 * the selection, so changing it never renders PCM again.
 *
 * Normalization renders only with the measurements of its exact inputs. While they are being
 * made, the audio that is already playing continues: the previous draft of an open preview, or
 * the draft that was just applied. Without such audio the track waits for its measurements.
 */
function resolveAudioPlaybackTracks(
  tracks: readonly AudioTrackState[],
  streams: readonly AudioStream[],
  preview: AudioFilterPreviewState | null,
  previous: ReadonlyMap<number, AudioPlaybackChain>,
): AudioPlaybackTracks {
  const chains = new Map<number, AudioPlaybackChain>();
  let ready = true;
  for (const track of tracks) {
    if (!track.enabled) continue;
    const stream = streams.find((candidate) => candidate.streamIndex === track.streamIndex);
    const previewing = preview?.streamIndex === track.streamIndex;
    const filters = previewing ? preview.filters : track.processing.filters;
    const analysis = previewing ? preview.loudnessAnalysis : track.loudnessAnalysis;
    const timing = {
      durationMicros: stream?.durationMicros,
      syncOffsetMicros: effectiveAudioOffsetMicros(
        previewing ? (preview.syncOffset ?? undefined) : track.processing.syncOffset,
      ),
      startTimeMicros: stream?.startTimeMicros ?? 0,
      streamIndex: track.streamIndex,
      volume: track.processing.volume,
    };

    const requiresMeasurements = audioFiltersRequireLoudnessAnalysis(filters);

    if (!requiresMeasurements || analysis.status === "ready") {
      const selection: AudioChainSelection = {
        filters: activeAudioFilters(filters),
        ...(requiresMeasurements && analysis.status === "ready"
          ? { loudnessMeasurements: analysis.value }
          : {}),
        streamIndex: track.streamIndex,
      };

      chains.set(track.streamIndex, {
        requested: filters,
        track: {
          ...timing,
          selection,
          ...(previewing ? { preview: true, tag: preview.revision } : {}),
        },
      });
      continue;
    }

    const held = previous.get(track.streamIndex);
    const holds =
      held !== undefined &&
      (previewing ||
        (held.track.preview === true &&
          analysis.status !== "failed" &&
          sameAudioFilters(held.requested, filters)));

    if (holds) {
      chains.set(track.streamIndex, { requested: filters, track: { ...held.track, ...timing } });
    } else {
      ready = false;
    }
  }
  return { chains, ready, tracks: [...chains.values()].map(({ track }) => track) };
}

export { resolveAudioPlaybackTracks };
export type { AudioPlaybackChain };
