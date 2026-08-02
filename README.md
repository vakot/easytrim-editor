# EasyTrim Editor

EasyTrim Editor is a fast, lightweight desktop video trimmer for making precise clips without saving large project files.

![EasyTrim Editor](apps/desktop/public/image.png)

## Features

- Import supported video files by selecting them or dragging them into the editor.
- Preview the source video with frame-accurate timeline and keyboard controls.
- Trim the start and end of a segment, or move the complete segment without changing its duration.
- Use Shift snapping, safe trim, loop playback, selected-segment playback, and adjustable playback speed.
- Inspect audio tracks with waveform previews.
- Mute tracks and adjust individual levels from -24 dB to +6 dB.
- Control overall preview/export volume independently from per-track levels.
- Keep selected tracks separate or merge them into one output track.
- Save a fast stream-copy cut when possible.
- Export an optimized render with resolution, frame-rate, and NVENC preset controls.
- Monitor active and completed renders in the export queue.
- Persist language, theme, and export presets between sessions.

The current editing session is kept in memory only. EasyTrim Editor does not save project files or restore an in-progress edit after restart.

## Download

Download the current [EasyTrim Editor 1.0.2 release](https://github.com/vakot/easytrim-editor/releases/tag/v1.0.2).

The release currently includes:

- Windows x64 NSIS installer (`.exe`);
- Windows x64 MSI installer (`.msi`);
- Linux x64 AppImage;
- Linux x64 Debian package (`.deb`).

FFmpeg is intentionally not bundled. Install FFmpeg and make both `ffmpeg` and `ffprobe` available to the application.

macOS bundles can be produced on macOS. Public macOS distribution additionally requires Apple signing and notarization credentials.

## Requirements

Development requires:

- Node.js 22.12 or newer;
- pnpm 11.18.0;
- Rust 1.97.1 installed through rustup;
- FFmpeg and FFprobe on `PATH`;
- platform-specific Tauri and WebView dependencies.

Windows also requires Microsoft C++ Build Tools with the **Desktop development with C++** workload and Microsoft Edge WebView2.

Linux requires the Tauri system libraries used by the release container, including WebKitGTK, AppIndicator, librsvg, patchelf, and xdg-utils.

macOS requires Xcode Command Line Tools. Homebrew FFmpeg installations in the standard Apple Silicon or Intel locations are supported.

## Quick start

Install dependencies:

```sh
pnpm install --frozen-lockfile
```

Start the desktop app in development mode with Vite hot reload:

```sh
pnpm dev
```

Build the production frontend and native executable for the current operating system:

```sh
pnpm build
```

Preview that production build in the full Tauri application:

```sh
pnpm preview
```

Frontend-only production commands are also available:

```sh
pnpm build:web
pnpm preview:web
```

The frontend-only preview cannot access native FFmpeg or Tauri functionality.

## Quality checks

Run the standard repository checks:

```sh
pnpm check
```

This covers formatting, linting, TypeScript checks, tests, release-script tests, and the production web build.

Native Rust checks can be run separately:

```sh
cargo fmt --all -- --check
cargo check --all-targets
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets
```

## Release artifacts

Release artifacts are built and uploaded manually to avoid consuming GitHub Actions minutes on every small change. GitHub Actions is reserved for the lightweight Linux pull-request build and manually dispatched release jobs.

### Windows

Build and upload Windows bundles from Windows:

```sh
pnpm release:local -- --tag v1.0.2 --platform windows
```

### Linux with Docker

Docker can build Linux x64 artifacts from Windows, macOS, or Linux:

```sh
# Build into artifacts/linux without uploading
pnpm release:linux -- --no-upload

# Build and upload to an existing release
pnpm release:linux -- --tag v1.0.2
```

Docker Desktop or another Docker daemon with Buildx must be running. The Linux container uses the pinned Node.js, pnpm, and Rust toolchains and does not receive GitHub credentials.

### macOS

Build macOS bundles on macOS:

```sh
pnpm release:local -- --tag v1.0.2 --platform macos-apple-silicon
```

Use `macos-intel` for Intel hardware. Public macOS distribution requires a Developer ID Application certificate and notarization credentials; keep those values in CI secrets and never commit them.

Release assets use predictable names:

```text
EasyTrim_<version>_<os>_<arch>_<bundle><extension>
```

Only final installers are uploaded. Build-only files such as `.icns` and `.sh` helpers are excluded.

## Project structure

```text
apps/desktop/
├── src/                 React, TypeScript, and feature modules
└── src-tauri/           Rust native process and Tauri integration
docker/                  Reproducible Linux release build
scripts/                 Development, icon, preview, and release helpers
.github/workflows/       Linux CI and manual release workflows
```

The native layer discovers and runs FFmpeg/FFprobe, handles media inspection and rendering, and exposes typed commands to the React interface. Audio preview, waveforms, fast cuts, and optimized renders are coordinated through this native media layer.

## License

EasyTrim Editor is distributed under the [MIT License](LICENSE).
