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

## Local release artifacts

Build and upload artifacts to an existing GitHub release without using GitHub Actions:

```sh
pnpm release:local -- --tag v1.0.1 --platform current
```

Supported platforms are `windows`, `linux`, `macos-intel`, and `macos-apple-silicon`. The command builds the current machine's native bundles and uploads them with `gh release upload`; authenticate with `gh auth login` first. Windows can build Windows artifacts, and Linux can be built inside WSL or a Linux Docker environment. macOS artifacts require a macOS machine because Apple targets cannot be built on Windows.

## Development

Start the Tauri desktop application with the Vite development server and hot reload:

```powershell
pnpm dev
```

Build both production layers for the current operating system, without creating an installer:

```powershell
pnpm build
```

Tauri runs the configured `beforeBuildCommand`, which creates the optimized Vite bundle in `apps/desktop/dist`, then embeds it into the release-mode Rust executable under `target/release`.

Launch that exact production executable locally:

```powershell
pnpm preview
```

No local web server is involved. Re-run `pnpm build` after changing frontend or native source. These commands are identical on Windows, Linux, and macOS once that operating system's Tauri build prerequisites are installed.

For frontend-only diagnostics, `pnpm build:web` and `pnpm preview:web` remain available, but native Tauri functionality is unavailable in the browser preview.

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
