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

Waveform generation analyzes activity and counts decoded samples in one pass, then streams each
selected audio track through a bounded-memory pixel-bucket reducer. It stores a versioned `ETWF`
envelope with one 8-bit square-root-scaled average-absolute amplitude per image column. A small
run-length encoding is used only when it reduces the artifact size. Source state owns each temporary
envelope, so replacing a source or regenerating a stream releases the old artifact. This still
decodes audio a second time for each selected track. Background media work can still take minutes.
Audio extraction and incompatible-source proxy encoding remain full-source operations. Original
codec, keyframe spacing, disk speed, and WebView support still limit seek latency; this is not a
guarantee of instantaneous decoding for every video.

The activity/sample-count pass remains separate from envelope aggregation. The exact decoded sample
count is needed before assigning the existing integer sample ranges to streaming bins. Combining
the passes would require retaining full decoded PCM before binning or changing that alignment; the
current measurements do not justify either tradeoff.

Run the opt-in FFmpeg fixture comparison and size/timing sample (one stream for three seconds plus
six alternating sound/silence streams for two minutes) with:

```sh
cargo test -p easytrim-editor-desktop envelopes_match_legacy -- --ignored --nocapture
```

The fixture compares every envelope column's expected square-root height with a decoded legacy
`showwavespic` PNG and prints envelope generation time, legacy PNG-render time, and aggregate
artifact sizes. It does not measure peak process memory or WebView Canvas/Gain latency; those require
profiling the packaged app on the target hardware. Use short and long representative local sources
with one and several audio streams when collecting release performance numbers.

One Windows run on this synthetic fixture measured 54.5 ms to prepare a three-second, one-stream
envelope (1,292 bytes) and 28.2 ms for its legacy PNG render (532 bytes). The two-minute, six-stream
fixture took 1.11 s for envelope preparation; its envelopes totaled 192 bytes versus 3,135 bytes
for PNG references. These synthetic patterns do not represent arbitrary audio. The PNG timing is
the standalone full-rate reference render stage, not an end-to-end measurement of the former
multi-pass pipeline. Canvas draw and live Gain timing plus peak memory remain unmeasured on the
packaged WebView.

Also test a real long source in the desktop app: drag rapidly in both directions, release while
playing, step frames, loop a trimmed segment, change audio tracks, and replace the source during a
seek. Confirm that the playhead follows input, the final preview lands precisely, audio resumes at
that position, and discarded sources stop requesting data. JSDOM tests simulate decoder events;
they do not measure WebView or disk latency.

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

## Desktop icon assets

Use the gradient background from `apps/desktop/public/logo-square.svg` as the full-bleed Mac icon
background in `apps/desktop/src-tauri/icon-sources/macos/logo_mac_composer.icon/Assets/background.svg`.
Keep the foreground mark in the separate `Assets/logo.svg` layer, and let macOS apply its system
icon shape. The Icon Composer source has no automatic fill, shadow, or translucency effects. Use
`apps/desktop/public/logo-symbol.svg` for generated Windows and Linux desktop icons and for in-app
branding, including the browser favicon.
`apps/desktop/public/logo-circle.svg` is retained as an unused asset; do not select it for a platform
or UI surface.

Regenerate the checked-in Windows and Linux icon files after changing the symbol asset with
`pnpm icons:generate`. macOS icons are compiled from the Icon Composer source during a macOS release
build with `pnpm icons:prepare-macos`.
