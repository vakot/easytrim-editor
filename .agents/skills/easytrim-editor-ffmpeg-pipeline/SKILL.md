---
name: easytrim-editor-ffmpeg-pipeline
description: Implement and review EasyTrim Editor media behavior with FFmpeg and FFprobe. Use for media inspection, stream metadata, preview proxies, audio waveforms, trim math, stream mapping, fast lossless cuts, hybrid audio merging, optimized rendering, scaling, frame-rate conversion, NVENC/CPU presets, custom FFmpeg arguments, progress parsing, codec/container compatibility, or media-focused tests and benchmarks. Pair with easytrim-editor-tauri-rust for process execution and easytrim-editor-react-interface for controls or user-facing media states.
---

# EasyTrim Editor FFmpeg Pipeline

Treat media behavior as correctness-sensitive. Preserve the selected interval and make unavoidable tradeoffs visible.

## Required context

Follow the auto-loaded `AGENTS.md`. Before media changes, read:

- [runtime and security](../../rules/security-runtime.md);
- [quality gates](../../rules/quality.md);
- [media contracts](references/media-contracts.md).

Inspect media DTOs/builders/capability detection/fixtures, and probe representative inputs before assuming stream layout, timing, rotation, color metadata, or compatibility.

Use `easytrim-editor-tauri-rust` for process/IPC changes and `easytrim-editor-react-interface` when controls or labels change media semantics.

## Preserve media invariants

- Export only `[trim_start, trim_end)` with positive duration.
- Use one canonical integer time unit; do not accumulate trim math in floating point.
- Preserve FFprobe global stream indexes and map streams explicitly.
- Keep source resolution and frame rate in fast video-copy mode.
- Generate preview/waveform helpers from the source but never use them as final export inputs.
- Interpret “merge audio” as one output audio stream; preserve stereo unless mono is explicitly requested.
- Never describe fast stream-copy cuts as frame-accurate.

## Probe deliberately

Use machine-readable FFprobe output:

```text
ffprobe -v error -of json -show_format -show_streams -show_chapters <input>
```

- Parse rationals as numerator/denominator.
- Prefer valid stream duration, then use an explicit format-duration fallback.
- Detect the primary video stream deliberately and retain all audio streams.
- Account for display rotation and preserve relevant tags/color/timing metadata.
- Distinguish average/real/variable frame-rate metadata.
- Return structured unsupported/invalid results for malformed input or missing video.

## Validate custom optimized arguments

The shared runtime/security rule owns process construction. Additionally:

- preserve the user's exact editable text and separately store validated tokens;
- keep input, trim, mandatory maps, and output application-owned;
- reject alternate inputs/outputs/trims and response files;
- detect conflicts with UI-owned maps, scale, frame-rate, audio filters, and filter graphs;
- show the parsed/assembled command preview and return validation errors instead of guessing precedence.

## Fast cut

- Copy video and each enabled compatible stream with explicit maps.
- Preserve a compatible source container for ordinary stream-copy output.
- Explain keyframe-constrained start behavior.
- With merge disabled, copy enabled audio streams.
- With zero selected audio streams, export video only.
- With one selected audio stream and merge enabled, copy it because merge is a no-op.
- With two or more selected tracks, copy video and mix to one normalized stereo AAC stream at 160 kbit/s, padded/capped to the segment; label the route “fast cut + audio merge.”
- Preserve the container for merged output only when compatible; otherwise select Matroska and show the extension before export.
- Fail instead of silently dropping or transcoding an incompatible selected stream.

Do not add hidden exact-cut repair encoding to the MVP fast route.

## Optimized render

- Encode only the selected interval.
- Preserve aspect ratio, even dimensions, and avoid accidental upscaling.
- Offer source, 2160p, 1440p, and 1080p based on actual source dimensions; avoid ambiguous “2K” implementation labels.
- Keep frame-rate selection independent from resolution and preserve fractional source rates.
- Map enabled audio independently or merge all enabled tracks through one labeled filter output.
- Preserve relevant color metadata when supported.
- Make unavailable hardware encoding an explicit error or user-visible fallback choice.

## Presets

Start with the benchmark candidate:

```text
-c:v hevc_nvenc -preset p5 -tune hq -rc vbr -cq 24 -b:v 0 -spatial_aq 1 -temporal_aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart
```

- Treat it as an initial RTX 4070 SUPER candidate, not a guaranteed throughput profile.
- Detect actual encoder availability from the packaged binary.
- Keep named presets in runtime memory only.
- Add H.264 NVENC and CPU fallbacks only with compatibility/quality tests.
- Benchmark representative 1080p and 4K sources before changing defaults.

## Preview and waveforms

- Try direct playback first; create a 720p-or-smaller compatible proxy only when needed.
- Generate one aligned, size-bounded waveform asset/data set per audio stream.
- Cancel helper generation on source replacement.
- Keep waveform failure non-blocking with an unavailable/retry state.

## Finish

- Summarize the assembled command shape without exposing unrelated private paths.
- State which streams are copied or encoded and any keyframe/container limitation.
- Report fixture/output-probe coverage and sample-specific benchmark data.
