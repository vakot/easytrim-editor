# EasyTrim Editor

EasyTrim Editor is a Windows-first desktop video trimmer built with Tauri 2, Rust, React, TypeScript, Vite, and FFmpeg.

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
- FFmpeg and FFprobe installed and available on `PATH`.

On a new Windows environment, enable the pinned pnpm version and install dependencies:

```powershell
corepack enable --install-directory "$env:LOCALAPPDATA\Microsoft\WindowsApps"
pnpm install
```

## macOS release validation

macOS development and release builds must run on macOS. Install Xcode Command Line Tools, Node.js, pnpm, Rust 1.97.1, and FFmpeg/FFprobe, then run:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm --filter @easytrim-editor/desktop tauri build --bundles app,dmg
```

Install the generated DMG and launch EasyTrim from Finder. The native media process runner checks the inherited `PATH` and the standard Apple Silicon and Intel Homebrew locations, so FFmpeg installed with Homebrew remains available to GUI launches. Verify import, preview, audio preview/mixing, fast cut, optimized render, dialogs, timeline controls, themes, language selection, and release/support notices from the installed app.

Public macOS distribution requires a Developer ID Application certificate and notarization credentials. Configure them only as CI secrets (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `KEYCHAIN_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID`); never commit certificates or credentials.

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
