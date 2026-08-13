# Media contracts

Read the relevant section before changing media behavior.

Process safety and argument-array execution live in the [runtime and security rule](../../../rules/security-runtime.md). Required output assertions and media fixtures live in the [quality rule](../../../rules/quality.md).

## 1. Canonical metadata

Store:

- source ID and validated absolute path;
- format name, duration, start time, and bitrate when present;
- video global stream index, codec, coded/display dimensions, sample aspect ratio, pixel format, color metadata, rotation, average rate, real rate, and time base;
- every audio stream's global index, codec, sample rate, channel count/layout, title, language, and default disposition;
- chapter metadata for inspection only.

Represent durations and positions as integer microseconds internally. Convert to decimal seconds only while formatting an argument or IPC display value.

## 2. Trim contract

```text
0 <= start < end <= source_duration
duration = end - start
```

- Clamp pointer-derived UI values before requesting export.
- Validate again in Rust.
- Format FFmpeg time arguments with enough decimal precision to preserve the canonical unit.
- Optimized output duration should match requested duration within roughly one output frame plus audio encoder delay.
- Stream-copy output can have a wider/keyframe-dependent tolerance; inspect actual packet timestamps.

## 3. Fast stream-copy shape

Illustrative ordering:

```text
ffmpeg -hide_banner -nostdin -ss <start> -i <source> -t <duration>
  -map 0:<video-global-index>
  -map 0:<enabled-audio-global-index> ...
  -c copy
  -avoid_negative_ts make_zero
  <output>
```

Command ordering and timestamp flags must be validated against fixtures before freezing behavior. Do not describe this as frame-accurate.

For merged audio:

```text
selected audio inputs -> normalization if needed -> amix/amerge policy -> one encoded audio output
video -> copy
```

Use `amix` for mixing tracks that should play together. `amerge` concatenates channels and is not a substitute for mixing. Choose an explicit channel layout after mixing; default to stereo.

Fast merge defaults:

- zero selected tracks: video-only output;
- one selected track: copy that track unchanged;
- two or more selected tracks: equal-weight `amix` with normalization, stereo AAC at 160 kbit/s, and silence padding/capping to the selected duration;
- merged title: `Merged audio`;
- merged language: `und`;
- merged stream: default disposition;
- synchronized keyframe-constrained start matching copied video.

Preserve the source container for separate stream-copy output. Preserve it for merged output only when it supports the chosen AAC stream; otherwise select Matroska and surface the extension before the save operation.

## 4. Optimized render shape

The application owns:

- global/logging/progress options;
- input and input seek;
- selected duration;
- mandatory stream maps;
- UI-selected scale and frame-rate filters;
- audio-selection/merge graph;
- final output path.

The custom preset owns:

- video/audio encoders;
- quality/rate-control settings;
- encoder presets/tuning;
- compatible muxer flags and optional metadata choices.

Reject at minimum custom occurrences of:

```text
-i
-ss
-sseof
-t
-to
-filter_script
-filter_complex_script
@response-file
unbound positional output paths
```

Also detect duplicate/conflicting `-map`, `-vf`/`-filter:v`, `-af`/`-filter:a`, and `-filter_complex` according to which UI controls are active. Prefer a clear error over accidental last-option-wins behavior.

## 5. Scaling contract

- “Source” applies no scale filter.
- Never infer resolution from marketing labels alone; calculate an actual bounding box.
- Preserve aspect ratio.
- Produce dimensions divisible by two for common 4:2:0 encoders.
- Do not upscale when the source already fits the requested bound.
- Respect display rotation when deciding whether the content is portrait or landscape.

Example intent:

```text
scale=<bound-width>:<bound-height>:
  force_original_aspect_ratio=decrease:
  force_divisible_by=2
```

Verify exact syntax against the bundled FFmpeg version.

## 6. Frame-rate contract

- “Source” preserves timestamps and does not add a constant-rate conversion filter.
- A selected rate intentionally converts timing; surface that it may duplicate/drop frames.
- Store common fractional rates as rationals such as `24000/1001`, `30000/1001`, and `60000/1001`.
- Do not round 29.97 to 30 or 59.94 to 60 internally.

## 7. Progress contract

Parse FFmpeg `-progress` records including:

```text
frame
fps
out_time_us or out_time_ms
speed
progress=continue|end
```

Calculate percentage from processed output time divided by selected duration, clamp display percentage to `[0, 100]`, and require successful process exit plus an existing output before reporting success.

## 8. Output verification

Apply the media gate in the [quality rule](../../../rules/quality.md). Add mode-specific tolerances for the behavior changed; do not weaken shared stream, duration, mapping, or readability assertions.

Use `-n` unless the user has explicitly selected and confirmed an existing output through the native save dialog; only that confirmation authorizes `-y`.

## 9. Webcam overlay

- Treat the webcam as one optional synchronized second video input; do not infer or expose manual timing offsets in the POC.
- Seek both inputs to the same canonical trim start and cap the output to the selected duration.
- Map the webcam's validated global video stream index explicitly and never map webcam audio.
- Scale the webcam to the code-defined small-overlay size while preserving its aspect ratio.
- Place standard corner presets directly against both output edges; apply margins only to explicitly inset presets.
- Compose it through one application-owned filter graph and map only the labeled composited video output.
- If the webcam ends early, pass through the main video without retaining the webcam's last frame or introducing a black placeholder.
- When webcam is absent or disabled, omit the second input and overlay graph entirely so the ordinary fast-copy route remains available.
