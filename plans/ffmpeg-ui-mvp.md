# ClipKit — FFmpeg UI MVP plan

## Goal

Build a small Windows-first video cutting application with a single, focused editing screen:

- import a known video file by drag-and-drop or file picker;
- preview the complete source, using a temporary lower-quality proxy when native playback cannot handle the source format;
- select one continuous segment by dragging the start and end handles on a timeline;
- show the source audio tracks as separate timeline rows with waveform previews;
- enable or disable individual audio tracks;
- export the selected segment either as a fast stream-copy cut or as an optimized re-encode;
- keep all editing state and named presets in memory only for the current run.

The first version is intentionally a single-clip editor. No project files, autosave, edit history, multi-clip timeline, effects, or cloud integrations are in scope.

## Proposed stack

### Application shell and native core

**Rust + Tauri 2**

- small Windows binary and low idle overhead;
- native file dialogs, drag-and-drop, process management, cancellation, and filesystem access;
- Rust owns all FFmpeg execution and validates user-provided arguments before starting a process;
- temporary preview and waveform files live in the OS temporary directory and are removed on exit when possible.

### UI

**React + TypeScript + Vite + Tailwind + shadcn**

- TypeScript and Vite remain directly reviewable by the project owner;
- React is widely understood by coding agents and suitable for a small reducer-driven single-screen workflow;
- timeline handles and audio-track toggles require no external state-management library;
- Tailwind utilities and shared shadcn primitives keep layout and controls consistent; focused CSS modules cover precision timeline and animation styling;
- compact top toolbar for the direct `Open video` action and in-memory preset control; no
  dropdown navigation or context menus.

### Repository workspace

**pnpm workspace + Cargo workspace**

- root scripts provide one entry point for formatting, linting, type checking, tests, and builds;
- `apps/desktop` contains the coupled React frontend and Tauri native application;
- shared packages are introduced only when a second real consumer exists;
- JavaScript and Rust dependency versions are pinned through committed lockfiles.

### Agent development skills

Project-local skills under `.agents/skills/` define the implementation and review standards:

- `clipkit-tauri-rust` owns Rust, Tauri, IPC, process lifecycle, security, temporary files, and native validation;
- `clipkit-ffmpeg-pipeline` owns FFprobe metadata, FFmpeg command contracts, trim/audio correctness, presets, and media tests;
- `clipkit-react-interface` owns the React/TypeScript single-screen UX, editor state, accessibility, frontend performance, and UI tests.

Cross-cutting work uses every applicable skill. This is especially important because Rust/Tauri implementation is AI-owned while the React/TypeScript surface remains reviewable by the project owner.

Repository-wide conventions are auto-loaded through `AGENTS.md`. Shared rules under `.agents/rules/` own engineering, structure, runtime/security, quality, and Git/PR policy so skills remain focused and do not duplicate guidance.

### Media toolchain

**FFmpeg + FFprobe**

- FFprobe JSON is the source of truth for duration, dimensions, frame rate, codecs, stream indexes, language, and audio-channel layout;
- FFmpeg performs proxy generation, waveform generation, stream-copy exports, and optimized exports;
- distribute a tested FFmpeg/FFprobe build with the application after checking the chosen build's LGPL/GPL obligations.

### Preview strategy

1. Try the source file directly in the embedded video element.
2. If the WebView cannot play it, generate a temporary 720p-or-smaller H.264/AAC proxy with FFmpeg.
3. Keep timeline positions in integer source microseconds; the proxy is only a viewing aid and is never used as the export source.

This avoids forcing every input through a full conversion while still allowing uncommon codecs and containers to be reviewed.

## Main-screen UX

The main screen contains only the controls needed for the current cut:

1. **Import flow** — before selection, a full-workspace landing view accepts a drop or picker
   action beneath a concise product introduction. The introduction disappears after selection;
   `Open video` remains directly available in the compact top toolbar, and dragging a file over
   the editor shows a clear replacement overlay.
2. **Preview** — an undecorated video surface with compact app-owned play/pause, previous-frame,
   next-frame, set-segment-start/end, current-time, and duration controls. Space toggles playback,
   Left/Right Arrow steps frames, and `I`/`O` set segment boundaries at the playhead. Independent
   Loop and Segment switches allow full-source playback, full-source looping, selected-segment
   playback, or selected-segment looping.
3. **Timeline** — one video row and one row for each audio stream. A shaded region identifies the selected export segment. Dragging the left or right handle trims only the start or end. The playback marker is independently draggable and continuously seeks the preview while moving.
4. **Audio rows** — track label, codec/channel information, waveform, and an enabled checkbox. Track ordering follows FFprobe stream order.
5. **Export settings** — output name, optimized resolution/framerate controls, merge-audio toggle, and a named in-memory FFmpeg preset field.
6. **Two primary buttons** — `Fast cut` and `Optimized render`, always visible and side by side. No submenu is required to choose the export route.

Importing another file immediately replaces the current source, resets trim handles and audio selections, and preserves the currently selected FFmpeg preset in memory.

After import, source metadata and audio-stream details occupy one narrow, vertically scrollable
left sidebar. The remaining main area is reserved for the video preview and timeline.

All discovered audio tracks start enabled. A failed replacement remains the current failed import and does not restore the previous source. Waveform generation failure is non-blocking and can be retried per track.

The output-name field is required. It starts from the source filename plus a route-specific suffix, for example `clip_fast.mkv` or `clip_optimized.mp4`. The fast route preserves a compatible source extension where possible. The name is validated as a filename and the destination is selected immediately before rendering.

## State and persistence

Use one in-memory application state object:

- source path and FFprobe metadata;
- proxy path and waveform paths;
- `trimStart` and `trimEnd` in integer source microseconds;
- audio stream enabled flags and merge-audio flag;
- optimized width/height and output frame rate;
- current FFmpeg argument string;
- named presets held in a runtime map;
- active operation, progress, cancellation state, and error message.

Do not write settings, projects, presets, or restore data to an OS configuration directory. Presets are available only until the application exits. Temporary media artifacts are implementation cache, not user state.

## Export behavior

### Fast cut

Default behavior is stream copy:

```text
ffmpeg -ss <start> -i <source> -t <duration> -map 0:<selected-streams> -c copy -avoid_negative_ts make_zero <output>
```

Important behavior to expose in the UI:

- video and audio remain at the source resolution and frame rate;
- the cut is fast and does not re-encode selected streams;
- the start may snap to a nearby keyframe because exact arbitrary-frame trimming is not generally possible with stream copy;
- disabled audio tracks are removed through `-map` selection;
- if `Merge audio into one channel` is enabled, only the audio stream(s) need to be re-encoded while video remains copied. This is a fast/hybrid export and should be labeled accordingly.

The command builder must never pass the original user string into the shell. It should construct an argument array and invoke FFmpeg directly.

### Optimized render

The optimized route re-encodes only the selected interval and allows independent resolution and frame-rate choices:

- source resolution, 4K → 2K, 4K → 1080p, or a custom supported size;
- source frame rate or a separately selected output frame rate;
- individual audio stream selection;
- optional downmix/merge to one audio stream;
- a raw FFmpeg argument string supplied by the user, saved under a runtime-only named preset.

The safest MVP contract for custom arguments is: the user supplies codec/filter/quality arguments, while the application owns input, trim, stream mapping, output path, and output container flags. The UI should show the assembled command preview so mistakes are visible before rendering.

## Default optimized preset

Use a hardware-aware balanced preset aimed at small files, close visual quality, and high throughput on the confirmed RTX 4070 SUPER:

```text
-c:v hevc_nvenc -preset p5 -tune hq -rc vbr -cq 24 -b:v 0 -spatial_aq 1 -temporal_aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart
```

Notes:

- HEVC NVENC is a good first default for size/quality/speed balance on this GPU.
- H.264 NVENC should be offered as a compatibility preset later.
- AV1 NVENC can be added as an optional smaller-file preset after testing target-player compatibility.
- The exact CQ value must be validated against representative 4K/1080p samples; the preset is an initial product default, not a quality guarantee.
- The UI should show a clear fallback/error if the installed FFmpeg build lacks `hevc_nvenc`.

## Audio waveform approach

For each audio stream, generate a compact temporary waveform image or sampled amplitude data with FFmpeg. Start with waveform previews because they are inexpensive and readable at a glance; add spectrogram rendering only if it proves materially useful.

The waveform renderer should:

- use source duration to align pixels to the same timeline scale as video;
- generate one asset per audio stream;
- downsample to the visible timeline width rather than retaining full-resolution samples;
- regenerate only when a new source is imported or the timeline size changes substantially.

## Suggested Rust command surface

Keep the Tauri boundary small and typed:

- `choose_source() -> SourceSelection`;
- `inspect_media(source_id) -> MediaInfo`;
- `prepare_source_preview(source_id) -> PreviewInfo`;
- `prepare_proxy_preview(source_id) -> PreviewInfo`;
- `prepare_waveforms(source_id, job_id, stream_indexes, width) -> WaveformResult[]`;
- `choose_output_path(default_name) -> Path`;
- `render_fast(request) -> OperationId`;
- `render_optimized(request) -> OperationId`;
- `cancel_operation(operation_id)`;
- `subscribe_operation_progress(operation_id)`.

Source replacement cancels source-bound preview and waveform helpers through the active source
token; no separate frontend cancellation command is needed for replacement.

All FFmpeg processes should be cancellable, capture stderr for diagnostics, and parse `-progress pipe:1` into elapsed time, total duration, speed, and completion percentage.

## Implementation phases

### Phase 0 — repository and toolchain bootstrap

- initialize the Rust/Tauri/React project;
- add formatting, linting, and a basic Windows development README;
- add an FFmpeg capability check and a clear missing-binary error;
- establish the in-memory state model.

### Phase 1 — import and inspect

- implement file picker and drag-and-drop for supported video containers;
- run FFprobe and render source metadata;
- replace an existing source immediately on new import;
- verify that no project or configuration files are created.

### Phase 2 — preview and trim UI

Status: implemented on the Phase 2 topic branch; real-file WebView codec coverage remains part of
the validation matrix.

- direct source preview with proxy fallback;
- timeline scale, playback cursor, and draggable start/end handles;
- app-owned playback/frame and set-in/out controls, global editor shortcuts, and continuously
  draggable playhead seeking;
- independent timeline looping and selected-segment playback bounds;
- keyboard-accessible handle adjustments and numeric time readouts;
- clamp trim values and reject empty selections.

### Phase 3 — audio tracks

Status: implemented on the Phase 3 topic branch; broader real-file validation across unusual audio
layouts and long sources remains part of the media matrix.

- list all audio streams;
- generate source-aligned, visible-width waveform images through a cancellable source/job contract;
- display one timeline row per global audio stream index with compact metadata and retryable,
  non-blocking waveform failures;
- enable every discovered track by default and keep per-track enable/disable state in memory;
- add optional merge-to-one-audio state with explicit fast/hybrid labeling for multiple selected
  tracks; export routing consumes this state in Phase 4.

### Phase 4 — exports

- implement fast stream-copy cut;
- implement optimized render with source/scaled resolution and independent frame-rate controls;
- make output naming required with route-specific defaults;
- add progress, cancel, success, failure, and reveal-in-folder states.

### Phase 5 — in-memory presets and hardening

- allow named presets to be created, selected, renamed, and deleted during the session;
- validate argument strings and render an assembled-command preview;
- test unusual stream layouts, variable frame rate, missing audio, Unicode paths, long paths, and failed/cancelled processes;
- benchmark 4K H.264/HEVC samples on the RTX 4070 SUPER and tune the default CQ/preset.

## Acceptance criteria for the first usable build

- A user can import a supported video by drop or picker in one action.
- The complete source is previewable, directly or through a temporary proxy.
- Start and end handles select exactly one continuous export range.
- Every audio stream is visible and can be enabled or disabled.
- Fast cut preserves source video resolution and frame rate and avoids video re-encoding.
- Optimized render can scale resolution and select a different frame rate.
- Both export buttons are visible on the main screen with no submenu step.
- The output name is required and prefilled from the source filename.
- Named presets survive source replacement during the current run but disappear after application exit.
- Cancelling an FFmpeg process works without leaving the UI stuck in a rendering state.
- No project, preset, or application configuration is written to the OS.

## Main risks and decisions to validate early

1. **Preview codec support:** test the Windows WebView with common H.264, HEVC, VP9, AV1, MOV, MKV, and TS inputs. Keep proxy fallback behind the same preview component.
2. **Fast-cut accuracy:** communicate keyframe snapping clearly and add exact-cut re-encode through the optimized route.
3. **Custom arguments:** do not allow arguments to override input/output or stream maps in the first version; this keeps the app safe and the UI predictable.
4. **FFmpeg distribution:** choose a redistributable build and document its license files before packaging.
5. **GPU portability:** ship a CPU fallback preset so the application remains usable when NVENC is unavailable.

## Initial directory layout

```text
clipkit/
├─ AGENTS.md         # Auto-loaded repository instruction index
├─ .agents/
│  ├─ rules/         # Shared repository-wide policies
│  └─ skills/        # Stack and domain workflows
├─ apps/
│  └─ desktop/
│     ├─ public/     # Static packaged frontend assets
│     ├─ src/        # React/TypeScript UI
│     └─ src-tauri/  # Rust/Tauri application core
├─ plans/
│  └─ ffmpeg-ui-mvp.md
├─ .github/
│  └─ pull_request_template.md
├─ Cargo.toml        # Rust workspace
├─ package.json      # Root scripts and shared JavaScript tooling
├─ pnpm-workspace.yaml
└─ README.md
```
