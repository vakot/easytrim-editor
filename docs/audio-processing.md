# Per-track audio processing

Each track persists its enabled state and an `AudioTrackProcessing` value. The current canonical
signal order is:

```text
Source → loudness normalization → final manual track gain → track output
```

`gainDb` always represents the user's final manual level adjustment. Future cleanup filters belong
before loudness normalization; future peak protection belongs after track gain. Those processors
are not implemented yet.

Export, loudness measurement, audio activity detection, and processed playback previews share the
native per-track FFmpeg filter graph. Processed preview artifacts carry the settings and revision
used to generate them. Playback only uses an artifact whose settings still match the current track.
This keeps stale asynchronous preview work from becoming audible after a setting changes.

When a single default track uses the default processing settings, playback can use the source
video's native audio route because that signal is equivalent to the processed output. Any track
settings that change the signal require a generated processed preview before that track is heard.
For multi-track playback, every enabled track uses its processed preview. In all routes, the export
equivalent signal feeds the meter before the global playback volume attenuates it for monitoring.

Waveforms continue to represent source audio and are independent of processing. Loudness and
activity analysis results describe the effective per-track processed signal. Muting only controls
participation in playback and export; it does not block configuration or analysis.
