import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioFilterPreviewChanged,
  audioFilterPreviewLoudnessAnalysisStarted,
  audioFilterPreviewStarted,
  audioReducer,
  audioTrackFiltersApplied,
  audioTrackLoudnessAnalysisFailed,
  audioTrackLoudnessAnalysisReady,
  audioTrackToggled,
  initialAudioState,
} from "@/app/store/slices/audio-slice";
import type { AudioFilter } from "@/domain/audio-processing";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { type AudioPlaybackChain, resolveAudioPlaybackTracks } from "../audio-playback-tracks";

const media = mediaWithAudio(firstSource.sourcePath);
const gain = (gainDb: number, enabled = true): AudioFilter => ({
  enabled,
  gainDb,
  id: `g${gainDb}`,
  type: "gain",
});

const normalization: AudioFilter = {
  enabled: true,
  id: "norm",
  loudnessRangeLu: 11,
  maxTruePeakDb: -1.5,
  targetLufs: -16,
  type: "loudnessNormalization",
};

const measurement = [{ filterId: "norm", integratedLufs: -20 }];

type AudioState = ReturnType<typeof audioReducer>;
type AudioAction = Parameters<typeof audioReducer>[1];

function audio(...actions: AudioAction[]): AudioState {
  return [
    sourceSelected({ source: firstSource }),
    sourceReady({ loadToken: 1, media }),
    // Only stream 2 plays, so each case reads one track.
    audioTrackToggled({ streamIndex: 4 }),
    ...actions,
  ].reduce(audioReducer, initialAudioState);
}

function resolve(state: AudioState, previous = new Map<number, AudioPlaybackChain>()) {
  return resolveAudioPlaybackTracks(
    state.tracks,
    media.audioStreams,
    state.filterPreview,
    previous,
  );
}

const startPreview = audioFilterPreviewStarted({ id: "preview", streamIndex: 2 });
const changePreview = (filters: AudioFilter[]) =>
  audioFilterPreviewChanged({ filters, id: "preview" });

const measure = (operationId: string) => [
  audioFilterPreviewLoudnessAnalysisStarted({ cacheKey: "k", id: "preview", operationId }),
  audioTrackLoudnessAnalysisReady({
    cacheKey: "k",
    operationId,
    result: measurement,
    streamIndex: 2,
  }),
];

describe("resolveAudioPlaybackTracks", () => {
  it("plays the previewed draft for its track and only its enabled filters", () => {
    const committed = resolve(
      audio(audioTrackFiltersApplied({ filters: [gain(3)], streamIndex: 2 })),
    );

    expect(committed.tracks).toEqual([
      expect.objectContaining({ selection: { filters: [gain(3)], streamIndex: 2 } }),
    ]);
    expect(committed.tracks[0]).not.toHaveProperty("preview");

    const previewed = resolve(audio(startPreview, changePreview([gain(-3, false), gain(6)])));
    expect(previewed.ready).toBe(true);
    expect(previewed.tracks).toEqual([
      expect.objectContaining({
        preview: true,
        selection: { filters: [gain(6)], streamIndex: 2 },
        tag: 1,
        volume: 1,
      }),
    ]);
  });

  it("keeps the audible chain while a draft's normalization is measured", () => {
    const playing = resolve(audio(startPreview, changePreview([gain(3)])));
    const measuring = audio(
      startPreview,
      changePreview([gain(3)]),
      changePreview([gain(3), normalization]),
    );

    const held = resolve(measuring, playing.chains);
    expect(held.ready).toBe(true);
    expect(held.tracks).toEqual(playing.tracks);

    // Without audio to keep, the track waits for its measurement like committed playback.
    expect(resolve(measuring)).toMatchObject({ ready: false, tracks: [] });

    const measured = resolve(
      audio(startPreview, changePreview([gain(3), normalization]), ...measure("op")),
      held.chains,
    );

    expect(measured.tracks[0]).toMatchObject({
      selection: { filters: [gain(3), normalization], loudnessMeasurements: measurement },
      tag: 1,
    });
  });

  it("keeps the earlier draft when the draft's measurement fails", () => {
    const playing = resolve(audio(startPreview, changePreview([gain(3)])));
    const failed = audio(
      startPreview,
      changePreview([gain(3)]),
      changePreview([normalization]),
      audioFilterPreviewLoudnessAnalysisStarted({
        cacheKey: "k",
        id: "preview",
        operationId: "op",
      }),
      audioTrackLoudnessAnalysisFailed({
        cacheKey: "k",
        error: { code: "render_failed" },
        operationId: "op",
        streamIndex: 2,
      }),
    );

    expect(resolve(failed, playing.chains).tracks).toEqual(playing.tracks);
  });

  it("keeps a just-applied draft playing until its measurement is ready, but not after Cancel", () => {
    const draft = [gain(3), normalization];
    const playing = resolve(audio(startPreview, changePreview([gain(3)])));
    const measuringDraft = resolve(audio(startPreview, changePreview(draft)), playing.chains);

    const applied = audio(audioTrackFiltersApplied({ filters: draft, streamIndex: 2 }));
    const keptAfterApply = resolve(applied, measuringDraft.chains);
    expect(keptAfterApply).toMatchObject({ ready: true, tracks: playing.tracks });
    expect(resolve(applied, keptAfterApply.chains).tracks).toEqual(playing.tracks);

    // Cancel restores the committed chain; an unmeasured one is never replaced by draft audio.
    const committedNormalization = audio(
      audioTrackFiltersApplied({ filters: [normalization], streamIndex: 2 }),
    );

    expect(resolve(committedNormalization, measuringDraft.chains)).toMatchObject({
      ready: false,
      tracks: [],
    });
  });
});
