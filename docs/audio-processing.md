# Per-track audio processing

Each track persists its enabled state and an `AudioTrackProcessing` value. Manual gain and
loudness normalization are alternative level policies:

```text
Source → optional high-pass cleanup → pre-level loudness measurement → one level policy → track output
                                                                  ├─ Manual gain
                                                                  └─ Loudness normalization
Track output → optional merge (raw sum, no track-count normalization)
```

`gainDb` stores the user's manual level adjustment. When normalization is enabled, it is dormant and
normalization controls the output level; disabling normalization restores the saved manual gain.
High-pass cleanup is configured per track with Off, 60, 80, 100, or 120 Hz cutoffs. It runs before
the pre-level measurement and before merge, so playback, analysis, and export use the same filtered
track signal.

The cached measurement is keyed by the stream, active trim range, and upstream processing inputs.
It excludes manual gain and normalization targets because those are downstream level controls.
Changing the trim or an upstream processor invalidates the measurement; changing gain or a
normalization preset reuses it. Changing the high-pass cutoff invalidates only that track's
measurement. Normalized preview and export both use the same measurement from the active trim range,
even though playback preview covers the full source. Future signal-shaping filters belong before the
measurement boundary. Peak protection belongs after the selected level policy.

Export, audio activity detection, and processed playback previews use the same effective level
policy: normalization replaces manual gain. Loudness measurement analyzes the track after its
pre-level high-pass cleanup and is independent of both manual gain and normalization targets. Processed
preview artifacts carry the processing settings and revision used to generate them. Playback only
uses an artifact whose settings still match the current track. This keeps stale asynchronous preview
work from becoming audible after a setting changes.

When a single default track uses the default processing settings, playback can use the source
video's native audio route because that signal is equivalent to the processed output. A track with
normalization requires a generated processed preview before it is heard. Manual gain remains a
lightweight runtime gain stage and does not rebuild the preview. For multi-track playback, every
enabled track uses its processed preview. In all routes, the effective track signal feeds the meter
before global playback volume attenuates it for monitoring. Merging sums the final per-track signals
without scaling them by track count; the meter observes that same sum.

Waveforms use the cached source shape with a vertical amplitude transform for the committed level
policy. Manual gain updates that transform live without regenerating source waveform data. The
normalization transform uses the same cached loudness and true-peak measurement as playback and
export, and ignores dormant manual gain. Draft dialog values never affect the waveform. Audio
activity analysis describes the effective level policy, so it can depend on manual gain in manual
mode or normalization in normalized mode. Muting only controls participation in playback and
export; it does not block configuration or analysis.
