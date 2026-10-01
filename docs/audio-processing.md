# Per-track audio processing

Each audio track has one persisted processing value and exactly one active level policy. The
current signal path is:

```text
Source
  → cleanup effects
  → dynamics effects
  → loudness measurement boundary
  → manual gain OR loudness normalization
  → final-protection effects
  → per-track output
  → optional merge
```

The implemented effects are High Pass, Noise Reduction, and Limiter. High Pass is unique within
each `(type, stage)` pair. The UI edits and summarizes the `cleanup` High Pass. Noise Reduction is
a singleton in `cleanup` and follows High Pass there. High Pass can also be represented in other
stages. Limiter is a singleton in `finalProtection` and always follows the selected level policy.
The TypeScript domain and Rust filter builder sort effects by the same stage and effect order.

## Level policy and measurement

`gainDb` stores manual gain. Without normalization, the track uses:

```text
pre-level effects → manual gain → Limiter
```

When loudness normalization is enabled, it replaces manual gain while leaving the saved `gainDb`
unchanged:

```text
pre-level effects → loudnorm → Limiter
```

Disabling normalization restores the saved manual gain. Loudness analysis measures the selected
trim after cleanup and dynamics effects and before either level policy or final protection. It
therefore excludes manual gain, normalization targets, and Limiter. The same measured values feed
normalization in playback and export.

Loudness results are keyed by source, stream, trim, and pre-level effects. Trim or pre-level effect
changes require a new measurement. Gain, normalization targets, and final-protection changes reuse
it. Final-protection changes still invalidate activity analysis because they alter the effective
track output.

## Playback and meter

The default source audio route remains available when one selected native track needs no processed
preview. Tracks that need processing use full-source FFmpeg audio preview artifacts. The artifact
uses the same pre-level effects, level policy, and final-protection order as export. Manual gain is
baked into a preview when Limiter is enabled, because applying gain after a nonlinear limiter would
change the exported signal. Manual gain without Limiter remains a runtime WebAudio gain and does
not require a new artifact. Normalized previews bake loudness normalization and ignore dormant
manual gain.

While the gain control is being dragged, WebAudio applies the difference between the draft value
and any gain already baked into the current artifact. For a limited track it follows that adjustment
with a WebAudio ceiling curve. This keeps draft playback responsive and bounds peaks while the new
committed artifact is prepared. Once the committed preview is ready, it contains the exact selected
level policy followed by Limiter.

Per-track playback signals feed the track mix and meter before the global playback-volume control.
The meter therefore reflects the effective per-track or merged signal without master-volume
attenuation. Optional audio merge combines the already processed track outputs after Limiter; it
does not change the individual track processing order.

## Waveforms and activity

Cached waveforms use a lightweight source-shape model:

```text
Source → pre-level signal-shaping effects → cached waveform
```

Pre-level High Pass and Noise Reduction affect waveform generation. Manual gain and loudness
normalization remain presentation transforms over the cached waveform. Limiter is excluded because
its output depends on the downstream level policy. Changing gain, normalization, or Limiter does not
regenerate the source-shape waveform; changing a pre-level effect does.

The separate activity/silence analysis uses the complete effective per-track signal, including the
selected level policy and Limiter. Its cached result changes when any effective input changes. The
waveform's source-shape signal-presence check remains tied to the waveform inputs.

## Cache and invalidation boundaries

| Cached result              | Inputs                                                                                                        | Changes that reuse it                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Loudness measurement       | Source, stream, trim, cleanup/dynamics effects                                                                | Manual gain, normalization targets, final-protection effects |
| Source-shape waveform      | Source, stream, width, pre-level effects                                                                      | Manual gain, normalization, final-protection effects         |
| Processed playback preview | Source, stream, effects, level policy; manual gain under Limiter; active trim and measurement when normalized | Manual gain without Limiter; dormant gain while normalized   |
| Activity/silence analysis  | Source, stream, effective level policy, all signal effects, and loudness measurements used by normalization   | No effective processing change                               |

Preview descriptors carry the processing settings used to create their artifact. Frontend preview
identity and invalidation compare those baked inputs, so stale asynchronous work is not accepted as
the current committed preview. Native request validation preserves the effect stage, singleton,
range, and uniqueness rules as a second boundary.
