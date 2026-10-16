# Per-track audio processing

Each audio track has one ordered filter chain and one Track Volume. The signal path is:

```text
Source audio
  → canonical input stage (48 kHz, first sample placed on the source timeline)
  → ordered audio filters (array order is execution order)
  → processed PCM
  → Track Volume (linear multiplier)
  → track mixing / optional merge
  → master output
```

`AudioTrackProcessing` is `{ filters: AudioFilter[]; volume: number }`. TypeScript
(`domain/audio-processing.ts`) and Rust (`media/audio_filters/model.rs`) share the same model and
ranges; Rust validates every request again.

## Filters

A filter is an instance with a stable `id`, an `enabled` flag, a `type`, and explicit parameters.
Every type may appear more than once.

A disabled instance keeps its position and parameters, and is saved with the chain in snapshots
and export requests, but it is never processed. The compiler validates it and then emits no stage
for it, so it never reaches FFmpeg and does not change any processed-audio identity: a disabled
filter leaves measurements, cached PCM, and waveforms keyed exactly as if it were absent. A disabled
normalization instance is not measured, and a chain whose filters are all disabled is unprocessed,
so an export can still stream-copy it. Toggling a filter is a chain edit like any other: it is
drafted in the Audio Filters dialog and committed on Apply. Chains saved before the flag existed
load with every instance enabled.

| Type                    | Parameters (valid range)                                             | FFmpeg stage                                   |
| ----------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| `highPass`              | `cutoffHz` 10–20000                                                  | `highpass`                                     |
| `noiseReduction`        | `reductionDb` 0.01–97, `noiseFloorDb` −80 to −20                     | `afftdn`, latency-compensated                  |
| `limiter`               | `ceilingDb` −24–0, `attackMs` 0.1–80, `releaseMs` 1–8000             | `alimiter` with look-ahead compensation        |
| `loudnessNormalization` | `targetLufs` −36 to −5, `maxTruePeakDb` −9–0, `loudnessRangeLu` 1–50 | second pass of two-pass `loudnorm` (see below) |
| `gain`                  | `gainDb` −60 to +24                                                  | `volume`                                       |

A chain holds at most 32 instances; identifiers are 1–64 characters of `[A-Za-z0-9_-]` and unique
within the chain. Presets (for example Noise reduction Light/Medium/Strong or loudness Web
Video/Streaming/Broadcast) are frontend templates: choosing one writes its explicit parameters, and
the stored model never contains a preset name. The editor shows "Custom" whenever the values match
no preset.

Gain and Loudness Normalization are ordinary filters. They coexist, and only their order decides
how they interact: Gain before normalization changes what is measured and is then compensated;
Gain after normalization changes the normalized output.

## Track Volume

Track Volume balances tracks; it is not a filter. It is a linear amplitude multiplier from 0 to 5
(0–500%), default 1. The slider covers 0–200%; manual input accepts up to 500%, and a value above
the slider range is shown at the slider end without being changed.

Track Volume never affects filter processing, loudness analysis, activity detection, waveforms, or
processed PCM identity, so changing it starts no FFmpeg work. Playback applies it with the track's
WebAudio `GainNode` and a short smoothing ramp. Export applies `volume=<multiplier>` after the last
filter and before any merge.

## The compiler

`compile_chain` is the only filter implementation. Export, analysis, activity detection, waveforms,
and playback rendering all use its output, so their processing cannot diverge. It validates the
chain, compiles each instance strictly in array order, and resolves every normalization instance
with its measurement; a missing measurement is an error, never a skipped or reordered filter.

- The canonical input stage `aresample=48000:async=1:first_pts=0` runs before the first filter, so
  coefficients, latency compensation, measurements, and sample positions are defined at one rate.
- `afftdn` delays its output by half of its 50 ms window (1200 frames at 48 kHz) and drops the same
  amount of tail. The compiled stage pads the tail and removes the delay, keeping output
  sample-aligned and complete.
- `alimiter` runs with `latency=1`, so its look-ahead does not shift the output.
- Loudness normalization reproduces loudnorm's own linear-mode decision. When loudnorm would apply
  one constant gain, the stage is `volume=<gain>dB` (bit-identical to loudnorm's linear pass and
  stateless). Otherwise it is dynamic `loudnorm` followed by a return to 48 kHz. An unmeasurable
  (silent) input passes through unchanged.

An empty chain compiles to nothing for export, so unprocessed tracks keep their source rate and can
still be stream-copied.

## Processing capabilities and strategies

Each compiled stage reports how it carries signal context. Global analysis is a property of the
filter type; the categories overlap.

| Category        | Meaning                                                            | Stages                                                |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| Stateless       | Each output sample depends only on the input sample at that point  | Gain, linear normalization                            |
| Stateful        | State decays (`Decaying`) or spans the whole history (`Unbounded`) | High-pass, Noise reduction, Limiter; dynamic loudnorm |
| Global analysis | Needs measurements of the complete range before rendering          | Loudness normalization                                |

The complete chain selects its `ExecutionStrategy`: `RandomAccess` when every stage is stateless,
otherwise `Sequential` with a warm-up equal to the sum of the stages' settle times. A Limiter is a
look-ahead gain envelope with release memory, never a hard clip, so it is stateful.

Any High-pass, Noise reduction, Limiter, or dynamic normalization makes the whole chain require
sequential rendering for canonical output. Gain-only chains and chains whose normalizations resolve
to linear gain are random-access.

## Global analysis

`analyze_chain_loudness` measures every normalization instance in chain order, each on the exact
signal reaching it: the analysis range processed by all earlier filters, including earlier
normalization instances resolved with their own measurements. Several normalization instances are
therefore measured in dependency order, one pass each. Passes run FFmpeg's first loudnorm pass into
a null output; no PCM is written.

Measurements are cached natively by source activation, stream, analysis range (the timeline
selection), and the compiled upstream chain. Changing an upstream filter, parameter, or order, the
source, or the range invalidates a measurement; downstream filters and the instance's own targets
do not. The frontend keeps a copy with the track (`loudnessAnalysis`) keyed the same way, passes it
with export requests so a queued export stays reproducible, and measures enabled tracks
automatically once their inputs settle, because playback waits for those measurements.

## Demand-driven rendering

`AudioProcessingEngine` (`media/audio_filters/engine.rs`) produces requested frame ranges of
processed audio. A request names the source stream, compiled chain, continuous rendering range, a
start frame, a length, and a channel count.

- **Canonical** output equals one continuous render of the whole range from its origin, exactly as
  an export of that range is rendered. Only renders that started at the origin are canonical.
- **Provisional** output comes from a render that seeked into the range with warm-up (decoder
  preroll plus the chain's settle time). It is a close preview, never authoritative.

Rendering runs in persistent FFmpeg sessions that stream raw f32 to the engine. A request first
reads everything the cache already holds and renders only the gaps:

1. A running session of the same key that is at most 10 seconds behind the gap continues through
   it, so consecutive requests never restart a stateful chain.
2. Otherwise, a gap within 10 seconds of the origin starts a session at the origin; its output is
   canonical at the cost of rendering the frames before the request.
3. Otherwise, a provisional session seeks before the gap by the strategy's preroll.

Each consumer of a source stream is one scope: playback (committed or previewed chains) and
waveform passes render independently, so auditioning a draft never stops a waveform pass. A scope
has an audible revision and, while playback changes processing, a replacement revision. A request
for a different key supersedes its scope's previous revision of the same kind: that revision's
sessions are terminated, its pending segments are rejected, and its callers receive
`media.audio.processingChangedBeforeAudioWasReady`. A replacement therefore never stops the audible
processing; requesting the replacement as audible processing completes the switch and releases the
previous audible revision. Scopes share cached segments but never sessions.
Cancellation (`cancel_operation` or source replacement) stops a request without discarding a
consistent session. Sessions are limited to four and end after 60 idle seconds. Reaching the limit
stops the least recently used session that no request is rendering with, and one rendering audible
processing only after every other kind; while every session is in use, none is stopped.

Positions are exact frame indexes on the 48 kHz source timeline. Seek points lie on a 125 µs grid
(six frames), where the seek time and the first output frame agree exactly; the canonical input
stage pads a late stream start. The range end is bounded by sample count in the graph (`apad` pads
a short stream with silence, `atrim` stops the render and so FFmpeg), never by an FFmpeg duration
limit. `-t` cuts by timestamp: it dropped the last samples of a range when `aresample` filled a
timestamp gap, and the session then ended before its range. Dynamic Loudness Normalization
(`loudnorm`) emits non-contiguous output timestamps for the same reason, so its compiled stage ends
with `asetpts=NB_CONSUMED_SAMPLES/SR/TB`. This also keeps an export's output duration limit from
cutting the last ~77 ms of a trim that reaches the end of its source.

A failed render reports the operation that asked for it: a waveform pass fails as a waveform error
and a playback chunk as a playback error, so one never surfaces as the other. The diagnostics name
the purpose, the frame the session had reached, the stream, how the FFmpeg process ended (exit
status), and the tail of its stderr. Set `EASYTRIM_MEDIA_DEBUG=1` to also print them.

### Processed PCM cache

The cache (`pcm_cache.rs`) stores raw interleaved little-endian f32 segments of at most two
seconds in a session temporary directory (`easytrim-pcm-*`). Segments are keyed by source
activation, stream, compiled graph (all parameters and resolved measurements, in order), rendering
range, and channel count, and addressed by exact frame index. Requests may be served partly from
cache and partly by rendering. A segment is indexed only after its file is completely written and
renamed into place, and only if its revision is still current. Canonical segments take precedence
over and replace provisional ones. Storage is bounded (1 GiB) with least-recently-used eviction;
a replaced source drops its segments and measurements. The directory is removed when the engine shuts down,
and stale leftovers are cleaned at startup.

## Compatibility boundaries

The engine is the future authoritative processed signal. In this version:

- **Playback** requests two-second stereo chunks through `decode_audio_playback_chunk`, which reads
  them from the engine over the whole source timeline (origin 0) and returns raw f32 bytes. Chunks
  requested in order continue one session. WebAudio applies only Track Volume; all filtering,
  including High-pass, is rendered natively.
- **Export** renders each track with the compiled chain followed by Track Volume in one continuous
  FFmpeg pass over the export range, which is the canonical definition; it does not read the PCM
  cache yet.
- **Activity detection** analyzes the compiled chain output without Track Volume.
- **Waveforms** reduce canonical stereo PCM from the engine, rendered with the complete committed
  chain over the same whole-timeline range as playback, so both share one render key and its
  cached segments. Normalization measurements are resolved first, exactly as for playback. The
  envelope is the signal before Track Volume, which only scales the canvas, so a volume change never
  regenerates it; any filter, parameter, or order change does, and so does a trim change when the
  chain contains normalization. A silent processed waveform does not disable its track; only a
  silent stream without filters does.
- A waveform pass rejects provisional cached segments and renders those frames continuously from
  the origin. When the stream's whole range would take more than half of the cache, the pass reuses
  cached segments but streams the frames it renders without caching them, so it never evicts the
  segments playback is using.

## Live preview

While the Audio Filters dialog is open, playback renders its draft chain for that track, so edits
are heard without Apply. The committed chain does not change until Apply: snapshots, exports,
analysis, activity detection, and waveforms ignore the preview, and waveforms regenerate only after
Apply. Track Volume stays independent of the preview.

- **Publishing.** The dialog publishes the latest valid draft as the track's `filterPreview` in the
  `audio` slice once edits pause for 120 ms, and at least every 300 ms during continuous edits such
  as a slider drag. An invalid draft keeps the last valid one audible. Cancel, closing, and source
  changes end the preview; Apply commits the complete draft, including changes not yet published.
- **Rendering.** The preview is an ordinary chain for the same compiler and engine. Playback
  requests it as `PlaybackPreview`, in the playback scope, so a newer draft supersedes the previous
  draft's sessions and never the waveform scope.
- **Switching without a gap.** When the processing changes during playback, the audible processing
  keeps rendering and playing, however long the replacement takes, while the new chain renders as a
  replacement from 50 ms ahead of the playhead. Every track then switches at one sample position
  with a 30 ms linear crossfade; both sides carry the same source signal, and playback continues
  with the new chain after the replacement's first chunk. The timeline mapping is unchanged, so
  audio stays aligned with the video. A newer change replaces a running one, so playback only
  switches to the latest processing, and a replacement equal to the audible processing, such as an
  undone edit, renders nothing. Only a start or seek claims audible ownership: while playback
  runs, it keeps requesting exactly the processing it plays, and any other request, including the
  prefetched restart of a loop, is a replacement. A start or seek that is still decoding starts
  again with the new chain. The same switch applies when Apply changes a chain during playback.
- **Loudness normalization.** A draft is measured 300 ms after its loudness inputs (the enabled
  filters up to the last normalization) settle. Edits downstream of the last normalization or of a
  normalization's own targets reuse the measurement. A draft whose inputs match the committed chain
  reuses its measurement, and the native measurement cache returns every completed measurement
  immediately. A measurement of inputs the draft has moved away from is cancelled unless the
  committed chain waits for it. Apply adopts the draft's measurement, or its running job, so
  applying never measures again. While a draft is measured, playback keeps the audio it is
  playing, the previous draft or the committed chain, and switches once the measurement arrives.
- **Failures.** A replacement that cannot be rendered never stops playback: the audible processing
  keeps playing and the track reports the failure. For a draft, as for one that cannot be measured,
  the dialog shows the preview as unavailable, and Apply still commits it. A committed chain that
  cannot be rendered when playback starts stops it, as before.
- **Temporary data.** Preview renders are temporary. Their cached audio has its own budget (one
  eighth of the cache) and is evicted before committed audio. When a stream stops auditioning
  drafts and its audible processing is no longer a draft (immediately when paused, after the switch
  when the committed chain is audible), playback calls `release_audio_playback_preview`: the sessions and audio of auditioned
  drafts are released, and a request still rendering one fails as superseded. The chain playback
  continues with, for example the applied draft, is kept and becomes committed audio, so it is not
  rendered again.

The dialog footer shows the readiness of the whole pipeline for the latest published draft:
measuring (`Analyzing loudness…`), rendering for a start (`Preparing audio…`) or to replace audible
audio (`Updating preview…`), ready (`Live preview active. Apply to save.`), or failed
(`Preview unavailable. Apply to save.`). A status is shown only after it has lasted 200 ms, and
shown progress stays at least 600 ms, so rapid edits do not flicker. A cancelled or superseded
request leaves no progress behind: pausing ends a running switch, and a draft playback does not
render reads as ready. Space and the arrow keys keep controlling playback while the dialog is
open, unless a control inside it is focused that uses those keys.

Measured on a two-minute AAC source (Ryzen 7 9850X3D, FFmpeg 9.0.1), a draft switch at 60 s renders
its first two seconds in about 30–40 ms for Gain, High-pass, Limiter, or Noise reduction, and in
0.2–0.7 s when dynamic loudness normalization needs its ten-second warm-up. Each normalization
instance measures the whole selection once, about 1.5 s for two minutes of audio.

## Migration of the stage-based model

Snapshots and stored export requests saved with the previous model
(`{ gainDb, loudnessNormalization?, effects?: [{ type, stage, … }] }`) migrate when recovered
(`domain/legacy-audio-processing.ts`):

- Effects keep the order the stage model executed them in (cleanup and dynamics, then the level
  policy, then final protection). Noise reduction presets and the fixed 5 ms / 50 ms Limiter timing
  become explicit parameters; normalization presets get a loudness range of 11 LU.
- Manual gain becomes Track Volume when that is audibly identical, which holds when no Limiter
  followed it. Gain that fed a Limiter stays a Gain filter at its original position. Gain above the
  500% Track Volume limit keeps the excess as a trailing Gain filter. New tracks start with an empty
  chain and 100% volume; no Gain filter is added otherwise.
- Gain made dormant by normalization never reached the output and is dropped.
- A stored request's single loudness measurement is assigned to its migrated normalization instance.

Deliberate differences from the previous processing:

- Processed audio is rendered at 48 kHz in every path; unprocessed tracks keep their source rate.
- Noise reduction is now latency-compensated. Previously processed exports were 25 ms late on
  noise-reduced tracks and lost the last 25 ms.
- Playback renders High-pass in FFmpeg instead of a WebAudio biquad, matching export.

## Known limitations

- Random-access decoding is not proven equal to continuous decoding. With AAC sources, a decode
  that starts after a seek measurably differs from the continuous decode even with preroll, so
  seeked renders stay provisional for every chain, including stateless ones.
- Playback is canonical only near the start of the source or while it continues a session; a
  distant seek plays a provisional preview.
- Dynamic loudnorm has unbounded memory; its provisional previews use a fixed ten-second warm-up.
- A rendering range must start on the 125 µs grid. Reusing the cache for export ranges will need
  trim origins snapped to it.
- Playback renders stereo. The channel count is part of the cache key so other layouts can be
  rendered without conflicts.
- A draft switch far from the start of the source renders provisionally, like a seek, so the
  audio after the switch can differ slightly from an export until playback continues past it.
- The Audio Filters dialog is modal: while it is open, playback is controlled only with Space and
  the arrow keys; the timeline cannot be clicked.
- A switch replaces the audio of every track at one sample position, so unchanged tracks are read
  again from the cache.

## Verification

Native tests (`media/audio_filters`) cover chain validation and serialization, exact execution
order, repeated instances, Gain/normalization coexistence, linear versus dynamic normalization,
latency compensation, capability classification, dependency-ordered and cached analysis, cache
partial coverage, precedence, isolation, eviction, and atomic writes, bit-exact equality of chunked
canonical renders with one continuous render for a stateful chain, session continuation,
provisional flagging, revision supersede, independent playback and waveform scopes, preview audio
budgets, promotion and release, audible processing that keeps rendering beside its replacement,
cancellation, and absolute positions across timestamp gaps.
Fixtures are generated with silence, transients, sustained tones, and loudness steps. Frontend tests
cover the domain model, legacy migration, recovery, Track Volume, playback wiring, automatic
measurement, the Audio Filters dialog's draft isolation and Apply/Cancel, and live preview:
sample-aligned crossfaded switches, continuous audible playback while a slow replacement renders, an integration test that holds a draft's loudness analysis and replacement render past all buffered audio while the loop restart is prefetched, switching only to the latest change, preview failures, changes during start
and preparation, draft measurement reuse, invalidation, cancellation and adoption on Apply, kept
audio while a draft is measured, native preview release, status reporting, and the playback
shortcuts while the dialog is open.
