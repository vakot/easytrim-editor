# Per-track audio processing

Each track persists its enabled state and an `AudioTrackProcessing` value. Manual gain and
loudness normalization are alternative level policies:

```text
Source → pre-level loudness measurement → one level policy → track output
                                               ├─ Manual gain
                                               └─ Loudness normalization
```

`gainDb` stores the user's manual level adjustment. When normalization is enabled, it is dormant and
normalization controls the output level; disabling normalization restores the saved manual gain.
Future signal-shaping filters may be placed before loudness measurement. Peak protection belongs
after the selected level policy. Those processors are not implemented yet.

Export, audio activity detection, and processed playback previews use the same effective level
policy: normalization replaces manual gain. Loudness measurement analyzes clean source audio at the
pre-level boundary and is independent of both manual gain and normalization targets. Processed
preview artifacts carry the processing settings and revision used to generate them. Playback only
uses an artifact whose settings still match the current track. This keeps stale asynchronous preview
work from becoming audible after a setting changes.

When a single default track uses the default processing settings, playback can use the source
video's native audio route because that signal is equivalent to the processed output. A track with
normalization requires a generated processed preview before it is heard. Manual gain remains a
lightweight runtime gain stage and does not rebuild the preview. For multi-track playback, every
enabled track uses its processed preview. In all routes, the effective track signal feeds the meter
before global playback volume attenuates it for monitoring.

Waveforms continue to represent source audio and are independent of processing. Loudness analysis
describes the pre-level source signal. Audio activity analysis describes the effective level policy,
so it can depend on manual gain in manual mode or normalization in normalized mode. Muting only
controls participation in playback and export; it does not block configuration or analysis.
