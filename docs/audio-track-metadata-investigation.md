# Audio track metadata editing investigation

## Recommendation

Audio metadata editing fits the existing FFmpeg export pipeline without re-encoding when the
selected audio is stream-copied. Keep the first implementation to three output settings: choose
the default among included audio tracks, edit a track's language, and edit its title. Preserve
source values until a user changes them. Treat this as a focused export feature rather than a
general metadata editor.

Metadata-only edits should work in both Fast Export and Optimized Export. Optimized Export may
already encode audio because of processing settings; metadata assignment itself does not require
encoding. Merged audio is one generated output stream, so individual source-track titles, languages,
and default flags cannot remain distinct on that output.

## Current support

- Native probing already reads the `language`, `title`, and `disposition.default` values from each
  audio stream in [`probe.rs`](../apps/desktop/src-tauri/src/media/probe.rs). The native and
  frontend `AudioStream` types expose these values.
- Audio rows use those fields to describe source tracks. Editable export metadata is not part of the
  audio selection or processing state.
- The Fast and Optimized Export requests carry selected source stream indexes and processing
  settings. Export builders map those streams, copy compatible audio or encode processed audio,
  and do not currently set output audio metadata or disposition explicitly.
- Editor snapshots save track enablement and processing. They are also used to restore editing
  instances and queued exports, so new editable values would need to be captured there to survive
  source switching and queue editing.

Relevant implementation: [`media.ts`](../apps/desktop/src/domain/media.ts),
[`audio-slice.ts`](../apps/desktop/src/app/store/slices/audio-slice.ts),
[`editor-snapshot.ts`](../apps/desktop/src/domain/editor-snapshot.ts), and
[`export.rs`](../apps/desktop/src-tauri/src/media/export.rs).

## FFmpeg behavior and constraints

FFmpeg accepts output stream metadata through options such as
`-metadata:s:a:0 language=eng` and `-metadata:s:a:0 title=Commentary`, and controls stream
dispositions with `-disposition:a:0 default`. Its stream specifier `a:0` refers to the first audio
stream in the output, not the input's global stream index. Therefore metadata must be associated
with the final mapped output order. This matters when users disable tracks or when filters create
new output streams.

The current FFmpeg documentation states that stream metadata is copied with mapped streams by
default. Explicit per-output-stream metadata options can override those copied values. It also
states that FFmpeg automatically marks the first stream of a type as default when there are several
such streams and none is marked. The app should set dispositions explicitly for every output audio
stream so that exactly the user-selected track is default, including when the source default was
disabled. If no audio is exported, no audio disposition applies.

These options do not change codec selection and can accompany stream copy. The output muxer controls
which metadata it can store, so language and title preservation must be verified in each supported
container. An empty edited value needs a defined meaning (remove the tag versus write an empty tag)
and format-specific output tests before it is exposed in the UI. Pass values as individual process
arguments through the existing native command builder; do not construct a shell command.

For merged output, the existing media contract assigns the single mixed stream the title `Merged
audio`, language `und`, and default disposition. Editing source metadata should not imply that the
mixed stream can retain metadata from each source track.

Reference: [FFmpeg documentation for stream specifiers, metadata, and dispositions](https://ffmpeg.org/ffmpeg.html).

## Bounded implementation plan

1. Add optional output metadata settings to each audio track's serializable editor snapshot. Keep
   the source probe result as the initial display value and store only user-edited output values.
2. Include the settings in Fast and Optimized Export requests. Validate that the designated default
   belongs to an enabled output track, and reject duplicate or stale stream indexes as the existing
   export boundary does for audio selections.
3. Build output metadata by output audio ordinal after all maps are finalized. Set language and
   title for mapped tracks and explicitly set `default` or `0` on every output audio stream. Keep
   merged output's established metadata policy.
4. Add small controls to each audio row for title, language, and default selection. Keep editing
   state source-bound and ensure snapshots, queued exports, and queue edits retain it.
5. Verify real FFmpeg output with `ffprobe` for stream-copy and encoded audio, disabled tracks,
   source defaults, changed defaults, and merged audio. Cover at least Matroska and MP4 if both
   remain supported export containers; assert stream count, language/title tags, and dispositions.

The main scope cost is settings propagation through editor snapshots and queued exports, not the
FFmpeg command syntax. This should stay separate from broader chapter, video, or container-level
metadata editing.
