# EasyTrim development

## Prerequisites

Install Node.js 22.12 or newer, pnpm 11.18.0, Rust 1.97.1 through rustup, and FFmpeg/FFprobe on
`PATH`. Tauri also needs platform dependencies: Microsoft C++ Build Tools (Desktop development
with C++) and WebView2 on Windows; the WebKitGTK, AppIndicator, librsvg, patchelf, and xdg-utils
libraries used by the release container on Linux; and Xcode Command Line Tools on macOS.

## Install and run

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` starts the desktop frontend in Vite development mode. Build the production frontend and
native executable for the current operating system with `pnpm build`; `pnpm preview` previews that
production build in the Tauri application. Frontend-only alternatives are `pnpm build:web` and
`pnpm preview:web` (the latter cannot access native FFmpeg or Tauri functionality).

## Checks

Run the standard web and repository checks with:

```sh
pnpm check
```

This runs formatting, linting, Knip, TypeScript and Storybook typechecks, tests, release-script
tests, the Storybook build, and the production web build. Individual scripts are available when a
focused check is more useful:

```sh
pnpm format:check
pnpm lint
pnpm knip
pnpm typecheck
pnpm typecheck:storybook
pnpm test
pnpm test:release
pnpm build:storybook
pnpm build:web
```

Native checks run from the repository root and use the workspace Cargo manifest:

```sh
cargo fmt --all -- --check
cargo check --all-targets
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets
```

## Large-source playback checks

Seeking keeps one decoder request in flight and replaces the pending destination with the newest
request. Dragging can use keyframe seeks where supported; release and frame steps remain exact.
Audio is repositioned after the final video seek, not on every pointer update. Source replacement
disposes the scheduler and pending interaction frames. Media range reads run on a blocking worker,
not the window thread, and each GET body is capped at 4 MiB.

Long-recording waveforms retain a rectified, downsampled amplitude envelope instead of full-rate
PCM. They target 16 samples per image pixel, with a 1 Hz floor. Silence detection still analyzes the
original samples. This reduces memory, not the requirement to decode the full audio; background
work can still take minutes. Audio extraction and incompatible-source proxy encoding also remain
full-source operations. Original codec, keyframe spacing, disk speed, and WebView support still
limit seek latency; this is not a guarantee of instantaneous decoding for every video.

Run the opt-in FFmpeg fixture check (six streams, alternating sound and silence) with:

```sh
cargo test -p easytrim-editor-desktop envelope_images -- --ignored --nocapture
```

Also test a real long source in the desktop app: drag rapidly in both directions, release while
playing, step frames, loop a trimmed segment, change audio tracks, and replace the source during a
seek. Confirm that the playhead follows input, the final preview lands precisely, audio resumes at
that position, and discarded sources stop requesting data. JSDOM tests simulate decoder events;
they do not measure WebView or disk latency.

## Playback speed and decoder workload

The speed field accepts 0.25×–100×; the slider remains 0.25×–3×. Rates through 5× use native
playback. Above 5×, audio is muted. While a timelapse is being prepared, the source video remains
paused at a native rate of 1× and a wall clock advances source time while the preview samples
frames. Once ready, the timelapse video plays sequentially at native 1×.
Sampling is capped at the source frame rate or 60 fps, whichever is lower. Only one seek can be
outstanding, and the latest requested frame replaces obsolete work. The sampler requests the next
frame as soon as the decoder settles; it does not add an artificial idle interval. The timeline
continues to track requested time without accumulating skipped frames.

Sampling uses `fastSeek` when available and exact seeks otherwise. Pause and frame stepping land
precisely; speed changes preserve the current source position. Native media events cannot replace
the sampled clock. Suspended/hidden windows do not accumulate time to catch up on restoration.

This bounds frame requests independently of the multiplier, not CPU/GPU time per frame. With
inter-frame codecs, decoding a target may require earlier reference frames; the browser may also
lack fast keyframe seeking. For active playback above 5×, EasyTrim therefore prepares a cached
speed-specific timelapse MP4 in native code. It contains only the sampled frames and is decoded
sequentially by the WebView; source seeking is mapped to the shorter preview timeline. Preparation
still has an upfront decode/encode cost for the source, and a prepared preview consumes temporary
storage. If preparation is still running, the seek sampler remains available as a fallback.

Regression coverage includes speed-independent request counts, decoder backpressure, background
suspension, pause, loops, source cleanup, and rate changes during pending seeks. These tests use a
controlled clock and simulated decoder events. Validate actual cadence and CPU/GPU usage with
representative long-GOP and intra-frame sources in the native app.

## Storybook

Use `pnpm storybook` for the interactive catalog and `pnpm build:storybook` for its production
build. See [Storybook](storybook.md) for story placement and design-system guidance.

## Release builds

Release artifacts are built manually. Build a local platform bundle with:

```sh
pnpm release:local -- --tag <tag> --platform <platform>
```

Supported platforms are `windows`, `linux`, `macos-apple-silicon`, and `macos-intel`. Add
`--no-upload --output <directory>` to inspect signed artifacts without uploading. Linux bundles
can be built from any host with Docker:

```sh
pnpm release:linux -- --no-upload
```

Signing credentials are required for published bundles. Keep them in environment variables or CI
secrets; never commit them.
