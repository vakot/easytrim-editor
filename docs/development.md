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

`pnpm dev` automatically applies `tauri.dev.conf.json`, using the separate application identifier
`com.vakot.easytrimeditor.dev`. Its profile persists across development sessions, including HMR.
Production retains `com.vakot.easytrimeditor`; production data is never migrated or cleared.

To test achievement unlocking from scratch, close any running development app and run:

```sh
pnpm dev -- --fresh
```

This clears the development application data before starting Tauri, including achievements,
splash discoveries, and usage statistics that drive milestone unlocks. It also resets preferences
stored in that profile. On Windows it clears the identifier directory under both `APPDATA` and
`LOCALAPPDATA` (including WebView2 storage); on Linux it uses `XDG_DATA_HOME` or
`~/.local/share`; on macOS it uses `~/Library/Application Support`. Cleanup requires absolute
paths ending in the exact development identifier and rejects symbolic links/junctions in the
target or its ancestors. Missing profiles are harmless; validation or cleanup errors stop startup.
Existing environment variables and the normal Vite/HMR workflow are preserved.

Run focused launcher/profile tests with `node --test scripts/__tests__/dev-profile.test.mjs`.

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

## Bundle analysis

Generate interactive production bundle reports on demand with:

```sh
pnpm build:analyze
```

The treemap report is written to `apps/desktop/dist/bundle-analysis.html`; the dependency graph
is written to `apps/desktop/dist/bundle-analysis-network.html`. The treemap helps find large
modules and compare emitted chunks, including parsed, gzip, and Brotli sizes. The network report
shows why modules are included and how static and dynamic imports connect. Reports are ignored by
Git with the rest of `dist/`. The analyzer runs only in this opt-in mode; a regular `pnpm build`
or `pnpm build:web` clears the previous frontend output before producing release files, so the
reports do not ship in production artifacts.

To investigate startup JavaScript, start at the HTML entry and its statically imported chunks.
In the network view, follow those imports to the project modules and dependencies that contribute
to the initial graph. Use the treemap to rank their emitted size, then compare gzip and Brotli
values when estimating transfer cost. Inspect large eager imports and feature barrels for optional
dialogs, menus, or tools that could move behind a lazy entrypoint. Check the dependency graph before
splitting: keep shared primitives and command infrastructure eager, and avoid boundaries that
duplicate common dependencies or create sequential chunk waterfalls. Dynamic-import edges are
candidate boundaries; confirm that the UI can remain unmounted until opened and still preload on
pointer hover or keyboard focus.

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

Waveform generation consumes canonical stereo float PCM from `AudioProcessingEngine`, using the
complete committed filter chain before Track Volume. It resolves Loudness Normalization
measurements over the selected trim range before rendering; the envelope still covers the full
source timeline, including silence before delayed streams and after shorter streams. Filter edits
invalidate the waveform, and trim edits invalidate it when the chain includes normalization.
Track Volume affects playback mixing and scales the canvas display without regenerating the envelope.

The reducer processes bounded PCM blocks and stores a versioned `ETWF` envelope with 8-bit peak
and RMS values for each stereo channel and column. Peaks and RMS are calculated in float before
quantization. The renderer shares its bounded disk cache with playback, but replaces provisional
seek samples with canonical continuous-render samples before using them in a waveform. A stream
whose processed range exceeds half of the cache is streamed into the reducer without being cached,
so regenerating it never evicts playback segments. Source replacement cancels work and releases
temporary envelopes and PCM cache entries. Background media work can still take minutes. Audio
extraction and incompatible-source proxy encoding remain full-source operations. Original codec,
keyframe spacing, disk speed, and WebView support still limit seek latency; this is not a guarantee
of instantaneous decoding for every video.

While a waveform regenerates, the track keeps drawing the previous envelope under a small loading
overlay. The replacement crossfades in over 250 ms once it has been fetched and decoded, or switches
at once with reduced motion; a failed regeneration keeps the previous envelope and offers a retry.

Run the FFmpeg-backed waveform fixtures and cache regressions with:

```sh
cargo test -p easytrim-editor-desktop media::waveform::tests
cargo test -p easytrim-editor-desktop canonical_
```

These fixtures cover complete ordered chains, dependent normalization stages measured over a trim,
delayed audio, bounded envelope encoding, replacement of provisional playback PCM, and uncached
streaming of large ranges. They do not measure peak memory, long-source performance, or packaged
WebView rendering latency.

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
