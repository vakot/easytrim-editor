# EasyTrim Editor

EasyTrim Editor is a fast, lightweight desktop video editor for making precise clips without
project files.

![EasyTrim Editor](apps/desktop/public/image.png)

## Features

- Import and preview video with precise timeline controls.
- Trim, move, crop, and loop a selected segment.
- Preview and mix audio tracks with waveform guidance.
- Save fast stream-copy cuts or export optimized renders.
- Track active and completed exports in the desktop queue.

## Requirements

Development requires Node.js 22.12+, pnpm 11.18.0, Rust 1.97.1 through rustup, and FFmpeg/FFprobe
available on `PATH`. Platform-specific Tauri dependencies are listed in
[Development](docs/development.md).

## Getting Started

Install dependencies and launch the desktop application in development mode:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Build

Build the production frontend and native executable for the current operating system with:

```sh
pnpm build
```

This produces an unbundled production executable. After building, `pnpm preview` launches that
executable locally; installer bundles are produced by the release workflow described below.

## Development

Run the comprehensive repository verification with `pnpm check`; use `pnpm test` for the focused
frontend test suite. See [docs/development.md](docs/development.md) for focused commands, Storybook,
Rust/native validation, release verification, and alternatives.

## Releases

Versions are synchronized across the workspace package, Cargo workspace/lockfile, and Tauri
configuration by `pnpm version:bump`. Tagged releases are built through the manual release tooling
and published as GitHub Release assets (Windows NSIS/MSI, Linux AppImage/DEB, and macOS DMG).
Download the [latest EasyTrim Editor release](https://github.com/vakot/easytrim-editor/releases/latest).
FFmpeg and FFprobe are required at runtime and are not bundled.

## Documentation

- [Architecture](docs/architecture.md)
- [State management](docs/state-management.md)
- [Runtime and security](docs/runtime-security.md)
- [Code conventions](docs/code-conventions.md)
- [Development](docs/development.md)
- [Diagnostics](docs/diagnostics.md)
- [Storybook](docs/storybook.md)
