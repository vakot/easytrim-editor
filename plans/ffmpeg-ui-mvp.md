# ClipKit — FFmpeg UI MVP plan

## Goal and current status

ClipKit is a Windows-first, single-clip video cutter built around FFmpeg. The MVP editing and
export workflow is implemented through phases 0–5. This document now records the product
contract, completed scope, measured default preset, and the work that remains before a packaged
release.

The application supports:

- importing or replacing one known video file through a picker or drag and drop;
- previewing the complete source directly or through a temporary compatibility proxy;
- selecting one continuous segment with start/end handles and a draggable playhead;
- previewing, muting, mixing, and adjusting every discovered audio stream;
- saving the selected segment through fast video-copy or optimized re-encoding;
- managing named optimized-render presets for the current process only;
- tracking queued exports, progress, cancellation, failure, completion, and reveal-in-Explorer.

No project files, autosave, edit history, multi-clip timeline, effects, cloud integration, or
persistent preferences are in scope.

## Stack

- **Tauri 2 + Rust** own native dialogs, opaque source/output registration, FFprobe parsing,
  FFmpeg argument construction, process lifecycle, cancellation, temporary artifacts, and path
  validation.
- **React + TypeScript + Vite** own the single-screen UI, in-memory editor/preset state, timeline,
  audio controls, export configuration, and history.
- **pnpm workspace + Cargo workspace** provide one repository-level quality workflow.
- **FFmpeg + FFprobe** provide inspection, proxies, audio previews, waveforms, stream-copy cuts,
  optimized rendering, and progress records.

The frontend receives opaque source/output IDs. It does not construct FFmpeg commands or receive
general filesystem/process authority. FFmpeg is invoked directly with an argument array, never
through a shell.

## Product flow

1. The welcome page accepts a video from the picker or drag and drop.
2. Import registers the path natively and returns an opaque source ID plus display name.
3. FFprobe supplies canonical metadata and global stream indexes.
4. The source is previewed directly; playback failure triggers a temporary 720p-or-smaller proxy.
5. The editor keeps source time in integer microseconds and displays frame-based timecode.
6. Start/end handles select `[trim_start, trim_end)` with a minimum one-second segment.
7. Every audio stream gets an aligned waveform and independent mute/volume control. Master gain is
   applied separately without rewriting per-track values.
8. `Save` (`Ctrl+S`) opens the fast-cut save dialog. `Export` (`Ctrl+E`) opens optimized settings,
   validates them natively, previews the assembled command, then opens the save dialog.
9. Export history remains visible for the process lifetime. Active exports can be cancelled and
   completed outputs can be revealed in Explorer.
10. Importing another source resets source-bound trim/audio state without confirmation and keeps
    runtime presets and export history.

Returning to the welcome page or restarting the application discards the editing session. No
project, preset, editor, or path state is written to OS configuration storage.

## Preview and timeline contracts

- Direct source playback is preferred; generated proxy media is preview-only and never exported.
- Preview audio streams are decoded once to temporary audio-only assets and mixed at runtime.
- Visual playhead movement uses `requestAnimationFrame`; canonical state commits are throttled.
- Playback restarts only after the committed seek settles. Duplicate media seeks are ignored.
- Space toggles playback; Left/Right step frames; `I`/`O` move segment start/end to the playhead.
- Shift enables magnetic snapping for playhead/trim/segment movement according to the editor rules.
- Safe trim following is optional and shares one directional-following implementation.
- Source replacement cancels source-bound preview/waveform work and ignores stale completions.

## Audio contract

- FFprobe global audio stream indexes are preserved end to end.
- Every discovered stream starts enabled at its original level.
- `0%`/below `-24 dB` is muted; unmuting a zero-level track restores a safe `-12 dB` level.
- Track gain supports `0–200%`; master gain scales preview and output independently.
- Disabled tracks are not mapped and are never included in merge operations.
- Merge means one normalized stereo output stream, not mono.
- Waveform failure is local, retryable, and does not disable export.

## Export contracts

Both routes export only `[trim_start, trim_end)` and explicitly map the selected global streams.
The native save dialog authorizes overwrite of the selected output via `-y`.

### Save (fast route)

- Copies source video without changing resolution or frame rate.
- Copies selected audio when gain is unchanged and merge is unnecessary.
- Re-encodes only selected audio when gain changes or multiple tracks are merged.
- Produces video-only output when no audio tracks are selected.
- Uses a keyframe-constrained stream-copy start and is not described as frame-accurate.

### Export (optimized route)

- Re-encodes the selected interval.
- Offers source, 2160p, 1440p, and 1080p bounds only when they do not upscale.
- Preserves display aspect ratio, handles rotated display dimensions, and uses even scaled sizes.
- Keeps frame rate independent from resolution, including common fractional rates.
- Applies selected audio gain/mapping or one normalized stereo merge.
- Accepts codec, quality, encoder-preset, tuning, bitrate, and compatible muxer options.

Rust rejects custom arguments that attempt to own input/output paths, trims, response files,
stream maps, filters, scaling, frame-rate conversion, channel layout, output format, overwrite
policy, or positional outputs. The command preview is assembled by the same native builder with
`<source>` and `<output>` placeholders, so private paths are not exposed.

## Runtime presets

- The initial preset is selected on startup.
- Presets can be created, selected, renamed/updated, and deleted.
- Presets and the current argument text survive source replacement.
- Presets exist only in React process memory and are discarded on reload/application exit.
- Names are required, unique within the session, and limited to 64 characters.

## Default optimized preset

The measured balanced default for the current RTX 4070 SUPER system is:

```text
-c:v hevc_nvenc -preset p3 -tune hq -rc vbr -cq 24 -b:v 0 -spatial_aq 1 -temporal_aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart
```

### Benchmark record (2026-08-01)

Environment:

- AMD Ryzen 7 5700X3D;
- NVIDIA GeForce RTX 4070 SUPER, 12 GB, driver 610.74;
- source: local 3840×2160 HEVC, `yuv420p`, 60 fps screen recording;
- workload: first 10 seconds, source resolution, video-only encode, CQ 24, identical AQ settings;
- temporary outputs were probed and removed after measurement.

| NVENC preset | Reported speed | Reported fps |    10 s output size |
| ------------ | -------------: | -----------: | ------------------: |
| P5           |         0.919× |        55.40 |     5,330,727 bytes |
| P4           |          1.02× |        61.58 |     5,323,836 bytes |
| **P3**       |      **1.56×** |    **93.97** | **5,522,645 bytes** |
| P2           |          1.70× |       102.17 |     5,685,835 bytes |
| P1           |          2.27× |       136.07 |     5,220,725 bytes |

On a separate five-second comparison, P5 measured SSIM `0.998070` and P3 measured `0.998012`
against the compressed source. P3 is selected because it materially improves throughput while
remaining nearly identical to P5 on this sample. This is one benchmark, not a universal quality or
speed guarantee. A representative local 4K H.264 source was not available.

## Implementation phases

### Phase 0 — repository and toolchain bootstrap

Status: complete.

- Tauri/React monorepo, strict tooling, development scripts, in-memory session model, and media
  capability status.

### Phase 1 — import and inspect

Status: complete.

- Picker/drop import, FFprobe metadata, immediate replacement, opaque native source registration,
  and no project/config persistence.

### Phase 2 — preview and trim

Status: complete.

- Source/proxy preview, custom transport, frame controls, keyboard shortcuts, timeline, playhead,
  trim/segment dragging, snapping, safe following, and resizable panes.

### Phase 3 — audio tracks

Status: complete.

- Per-stream waveforms, audio-only preview mixing, track/master gain, mute restoration, stream
  selection, and optional merge.

### Phase 4 — exports

Status: complete.

- Fast and optimized routes, native save dialog, overwrite confirmation, output naming, queue,
  progress, cancellation, failure/completion history, and reveal in Explorer.

### Phase 5 — in-memory presets and hardening

Status: complete on `feature/vakot/phase-5/in-memory-presets-hardening`.

- Full runtime preset lifecycle preserved across source replacement.
- Native custom-argument validation and path-redacted assembled-command preview.
- Fractional frame-rate choices and rotated/no-upscale resolution validation.
- Duplicate/unavailable stream, no-audio, malformed argument, Unicode/space/long-path, failed
  process, early cancellation, and idempotent cancellation coverage.
- RTX 4070 SUPER benchmark and default preset tuning from P5 to P3.

## MVP acceptance status

- [x] Import or replace a supported video in one action.
- [x] Preview the complete source directly or through a temporary proxy.
- [x] Select one continuous segment with accessible start/end handles.
- [x] Display and independently control every discovered audio stream.
- [x] Preserve source video resolution/frame rate without video encoding on the fast route.
- [x] Scale resolution and select an independent frame rate on the optimized route.
- [x] Keep `Save` and `Export` directly available in the main toolbar.
- [x] Require a native output filename prefilled from the source name.
- [x] Preserve named presets across source replacement and discard them on process exit.
- [x] Cancel FFmpeg operations without leaving active UI state or partial output.
- [x] Avoid project, preset, path, and editor-state persistence.

## Remaining release work

These items are intentionally outside completed phase 5 and remain before declaring a broadly
redistributable Windows release:

1. **Packaged media binaries and licensing** — select and pin redistributable FFmpeg/FFprobe
   sidecars, include required LGPL/GPL notices, and stop relying on `PATH` in production builds.
2. **Compatibility presets** — add a tested H.264 NVENC preset and a CPU fallback with explicit
   encoder availability; consider AV1 only after target-player compatibility testing.
3. **Real-file validation matrix** — exercise H.264, HEVC, VP9, AV1, MOV, MKV, WebM, and TS;
   include VFR, fractional rates, no/mono/stereo/surround/many-audio layouts, rotation, near-EOF
   trims, Unicode and long Windows paths, and incompatible stream/container combinations.
4. **Output verification suite** — add deterministic redistributable fixtures and probe fast,
   hybrid, and optimized outputs for stream counts, dimensions, frame rate, duration tolerance,
   mapping, merge behavior, readability, failure cleanup, and cancellation cleanup.
5. **Additional performance evidence** — benchmark representative 4K H.264 and longer/mixed
   content; record quality, output size, elapsed time, and decode bottlenecks before promising a
   throughput target.
6. **Windows packaging QA** — test install, upgrade/uninstall, first run, missing/unavailable GPU
   encoder behavior, WebView codec fallback, temporary-artifact cleanup, and signed release assets.

Until those release items are complete, the application is an implemented and testable MVP rather
than a production-distributed build.
