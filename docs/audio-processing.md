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

Each source stream is one scope. A request for a different key supersedes the previous revision:
its sessions are terminated, its pending segments are rejected, and its callers receive
`media.audio.processingChangedBeforeAudioWasReady`. Cancellation (`cancel_operation` or source
replacement) stops a request without discarding a consistent session. Sessions are limited to four
and end after 60 idle seconds.

Positions are exact frame indexes on the 48 kHz source timeline. Seek points lie on a 125 µs grid
(six frames), where the seek time and the first output frame agree exactly; the canonical input
stage pads a late stream start; input stops exactly at the range end, as an export does, and a
short stream is padded with silence.

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

## Verification

Native tests (`media/audio_filters`) cover chain validation and serialization, exact execution
order, repeated instances, Gain/normalization coexistence, linear versus dynamic normalization,
latency compensation, capability classification, dependency-ordered and cached analysis, cache
partial coverage, precedence, isolation, eviction, and atomic writes, bit-exact equality of chunked
canonical renders with one continuous render for a stateful chain, session continuation,
provisional flagging, revision supersede, cancellation, and absolute positions across timestamp
gaps. Fixtures are generated with silence, transients, sustained tones, and loudness steps.
Frontend tests cover the domain model, legacy migration, recovery, Track Volume, playback wiring,
automatic measurement, and the Audio Filters dialog's draft isolation and Apply/Cancel.
