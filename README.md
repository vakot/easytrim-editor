# ClipKit

ClipKit is a Windows-first desktop video trimmer built with Tauri 2, Rust, React, TypeScript, Vite, and FFmpeg.

The repository is a pnpm monorepo. The initial workspace contains one desktop application:

```text
apps/desktop/
├─ src/          React interface
└─ src-tauri/    Rust/Tauri native core
```

## Prerequisites

- Node.js 22.12 or newer;
- Corepack, included with Node.js;
- Rust 1.97.1 through rustup;
- Microsoft C++ Build Tools with the **Desktop development with C++** workload;
- Microsoft Edge WebView2;
- FFmpeg and FFprobe will be integrated as pinned sidecars in a later phase.

On a new Windows environment, enable the pinned pnpm version and install dependencies:

```powershell
corepack enable --install-directory "$env:LOCALAPPDATA\Microsoft\WindowsApps"
pnpm install
```

## Development

Start the Tauri desktop application:

```powershell
pnpm dev
```

Run the frontend quality gate:

```powershell
pnpm check
```

Run the native quality gate:

```powershell
cargo fmt --all -- --check
cargo check --all-targets
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets
```

The application stores no editor state, presets, or project configuration on disk.
