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
