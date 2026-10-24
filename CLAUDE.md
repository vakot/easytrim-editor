# CLAUDE.md

EasyTrim Editor is a desktop video trimmer (no project files): import a video, trim/crop/loop a
segment, mix audio tracks with waveforms, and export via FFmpeg (Fast or Optimized) through a queue.
It is a Tauri 2 app with a React 19 frontend and a Rust native layer.

`AGENTS.md` is the authoritative workflow contract (branches, commits, PRs, verification, scope) and
points to detailed rules in `.agents/rules/` and task skills in `.agents/skills/`. Read the relevant
ones before editing; this file is an orientation map, not a replacement.

## Commands

pnpm workspace, run from the repo root. Requires Node >=22.12, pnpm 11.18, Rust 1.97.1, and
FFmpeg/FFprobe on `PATH` (not bundled).

```sh
pnpm install --frozen-lockfile
pnpm dev                 # Tauri app in Vite dev mode
pnpm build               # production frontend + native executable (--no-bundle)
pnpm build:web           # frontend only; no Tauri/FFmpeg access
pnpm check               # full gate: format, lint, knip, typecheck, tests, storybook, build
pnpm format:check | lint | knip | typecheck | typecheck:storybook | test | test:release
pnpm i18n:check          # translation validation (also part of `pnpm lint`)
pnpm storybook
pnpm --filter @easytrim-editor/desktop exec vitest run <path>   # single test file
pnpm --filter @easytrim-editor/ui exec vitest run <path>        # single shared-UI test file
```

Native checks (workspace `Cargo.toml` at root, crate `easytrim-editor-desktop`):

```sh
cargo fmt --all -- --check
cargo check --all-targets
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets
```

`changelog:prepare` runs automatically before dev/build/test/typecheck. `pnpm version:bump` keeps
the package, Cargo, and Tauri versions in sync.

## Layout

```text
apps/desktop/            the only app (coupled React + Tauri)
  src/                   frontend (Vite, Vitest + jsdom, Storybook)
    app/                 composition: layout, providers, dialogs, commands, store/
    features/            source, preview, timeline, audio, export, playback, media, activity, changelog
    components/ui/       shadcn/Radix primitives (generic, no Redux/product knowledge)
    domain/              pure shared product logic (trim, crop, media-time, editing-instance, ...)
    lib/                 technical adapters; lib/tauri/ = typed native IPC wrappers
    i18n/                locales (en canonical, ru), schema, validation
    test/                shared test setup, factories, mocks
  src-tauri/             Rust crate: commands/ -> application/ -> domain/ media/ process/, state.rs
packages/ui/             @easytrim-editor/ui: source-only shared primitives, effects, tokens, cn
                         (consumed via package `exports` subpaths; no desktop/Tauri/Redux/i18n)
scripts/                 dev, release, versioning, changelog, i18n tooling (tests in scripts/__tests__)
docs/                    architecture, state-management, runtime-security, code-conventions, etc.
```

The top-level `src/` directory is a stray (empty hooks folder), not part of the app.

## Architecture essentials

- **Authority boundary:** Rust owns filesystem paths, FFprobe/FFmpeg construction and spawning,
  cancellation, and temp files. The frontend works with opaque source IDs and calls only typed
  adapters in `src/lib/tauri/`; never use generic `invoke`, build FFmpeg args, or parse stderr in
  the frontend. Native flow: thin Tauri commands -> application use cases -> framework-independent
  domain/media/process modules. Tauri types stay in command/entrypoint modules.
- **Frontend dependency direction:** `main -> app -> feature public APIs`; features may use app
  state contracts, `components/ui`, `domain`, `lib`. Cross-feature imports go through the target's
  `index.ts` only. Shared UI/domain never import features.
- **State:** Redux Toolkit (`app/store/`: slices, thunks, listener middleware, `integration/`
  runtimes, `recovery/`). Components select state and dispatch themselves; do not pass Redux values
  or handlers through intermediate components as props. Props are small and identity-based
  (`streamIndex`, `instanceId`). Reducers are pure. Never dispatch per frame/pointer move. Local
  React state for transient UI; runtime handles (DOM/media refs, timers, AudioContext, Tauri
  objects) stay with their runtime owner. Only panel layout and preferences are persisted.
- **Editing instances:** the `editingInstances` slice owns drafts and export attempts, keyed by
  `instanceId` / `attemptId`; stale async results are ignored by source/operation/job IDs. See
  `docs/editing-instance-lifecycle.md` and `docs/ownership-ledger.md`.
- **Exports:** one native FFmpeg export at a time; each queued job holds its own source reservation.

## Conventions

- Dirs are `kebab-case`; components `PascalCase.tsx` with named exports (default exports only where
  tooling requires). `app/` components use the `App<Name>` prefix, `app/layout` uses `AppLayout<Name>`.
  `components/ui` keeps kebab-case shadcn names.
- Feature components live in `features/<f>/components/`; a large cohesive component may be a nested
  package with its own `components/ hooks/ contexts/ lib/ index.ts`.
- Tests: `__tests__/ComponentName.test.tsx` beside the owner; stories in `__stories__/`
  (`ComponentName.stories.tsx`, typed CSF). Shared fixtures go in `src/test/`.
- Optional heavy dialogs/menus are lazy-loaded (`dialogs/<Name>/<Name>.tsx` wrapper +
  `<Name>Content.tsx`) with an intent preload on hover/focus.
- Tailwind semantic tokens (`bg-card`, `text-muted-foreground`); class order is Prettier's job.
  Shared components expose only `className` for styling and forward native props.
- Use `React.lazy` only for substantial optional UI; avoid ownerless `utils.ts`/`helpers.ts`.
- Don't add test-only production exports or disable lint/serializability checks to silence warnings.

## Repo-specific rules to remember

- **Git:** work on `<type>/<username>/<title>` branches (never `master`); commit incrementally as
  `<type>(<context>): <title>`, no commit body, no co-author trailers; never push or open PRs unless
  asked. PRs use `.github/PULL_REQUEST_TEMPLATE.md` unchanged.
- **Translations:** English (`src/i18n/locales/en.ts`) is canonical. Do not add or edit Russian
  wording unless explicitly asked; missing keys fall back to English. See `src/i18n/README.md`.
- **Skills** (`.agents/skills/`): load `easytrim-editor-tauri-rust`, `-ffmpeg-pipeline`,
  `-react-interface`, `-redux-state` when the work touches those domains.
- **Security:** treat capability, CSP, plugin, protocol, and bundled-binary changes as
  security-sensitive (`docs/runtime-security.md`). Avoid logging full user paths.
- Before claiming completion, inspect the diff and run the relevant checks above; state clearly
  any check that was not run.
