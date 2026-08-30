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

## Getting Started

Install Node.js 22.12+, pnpm 11.18.0, Rust 1.97.1, and FFmpeg/FFprobe on `PATH`, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Platform-specific Tauri prerequisites are documented in [Development](docs/development.md).

## Development

See [docs/development.md](docs/development.md) for checks, Storybook, native validation, and
release workflows.

## Releases

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
