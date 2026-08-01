# Repository structure rule

Apply this rule when creating, moving, or reviewing files and module boundaries.

## Canonical layout

Grow toward this structure:

```text
clipkit/
├─ AGENTS.md
├─ .agents/
│  ├─ rules/                         # Shared auto-applied repository policy
│  └─ skills/                        # Task-specific agent workflows
├─ .github/
│  └─ pull_request_template.md
├─ apps/
│  └─ desktop/
│     ├─ public/                      # Static packaged frontend assets only
│     ├─ src/
│     │  ├─ app/                      # Composition, session reducer, app shell
│     │  ├─ components/               # Reusable presentational components
│     │  ├─ features/
│     │  │  ├─ import-source/
│     │  │  ├─ preview/
│     │  │  ├─ timeline/
│     │  │  ├─ audio-tracks/
│     │  │  └─ export/
│     │  ├─ lib/
│     │  │  └─ tauri/                 # Typed IPC adapter; no generic invoke use
│     │  ├─ styles/                   # Tokens, reset, and shared layout styles
│     │  ├─ test/                     # Frontend test setup and shared factories
│     │  ├─ types/                    # Truly cross-feature TypeScript contracts
│     │  └─ main.tsx
│     └─ src-tauri/
│        ├─ binaries/                 # Pinned packaged sidecars
│        ├─ capabilities/             # Explicit Tauri permissions
│        ├─ src/
│        │  ├─ application/           # Use-case orchestration
│        │  ├─ commands/              # Thin Tauri IPC adapters
│        │  ├─ domain/                # Framework-independent types/invariants
│        │  ├─ media/                 # Probe, preview, waveform, export builders
│        │  ├─ process/               # Child lifecycle, progress, cancellation
│        │  ├─ error.rs
│        │  ├─ lib.rs
│        │  ├─ main.rs                # Minimal desktop entry point
│        │  └─ state.rs
│        └─ tests/                    # Native integration tests
├─ packages/                          # Shared packages after a second consumer exists
├─ plans/                             # Product and implementation plans
├─ scripts/                           # Deterministic repository automation
└─ tests/
   └─ fixtures/
      └─ media/                        # Tiny generated/redistributable fixtures
```

Do not create empty directories merely to match the diagram. Add a directory when its first owned file is needed.

The root pnpm workspace owns shared tooling and scripts. `apps/desktop` owns its runtime
dependencies and the coupled React/Tauri application. Add a package under `packages/` only when
at least two workspace consumers need a stable shared contract; do not split code merely to make
the repository appear modular.

## Dependency direction

Frontend:

```text
main -> app -> features -> components/lib/types
```

- A feature may import shared components, the typed Tauri adapter, and shared types.
- Do not import another feature's internal files. Promote genuinely shared behavior to a narrowly named shared module.
- Keep IPC calls in `apps/desktop/src/lib/tauri/`; components and reducers consume typed functions, not generic `invoke`.
- Keep product state in `apps/desktop/src/app/` or the owning feature. Keep visual-only state local to components.
- Consume another feature through its deliberate `index.ts` API; never reach into its internal folders.

## Frontend feature shape

Once a feature has multiple responsibilities, use only the folders it needs:

```text
features/<feature>/
├─ components/   # Presentational feature UI and feature-local CSS modules
├─ hooks/        # Stateful orchestration and effects
├─ utils/        # Pure calculations and formatters
├─ types.ts      # Feature contracts
├─ index.ts      # Deliberate public API
└─ <Feature>.tsx # Thin feature composition boundary
```

- Prefer shadcn primitives from `components/ui` before creating an interactive primitive.
- Use Tailwind utilities for ordinary layout, spacing, typography, color, and state styling.
- Use a colocated `*.module.css` only when precise pseudo-elements, keyframes, or browser-native styling are materially clearer than utilities.
- Keep components presentational. Put effects, async work, subscriptions, and multi-step state transitions in an owning hook or higher-level composition boundary.
- Keep `styles/globals.css` limited to Tailwind imports, theme tokens, reset, and truly application-wide defaults.

Native:

```text
commands -> application -> domain/media/process
                    \----> managed in-memory state
```

- Only `commands/`, `lib.rs`, and `main.rs` depend on Tauri runtime types.
- Keep `domain/`, media argument builders, validation, and most process logic framework-independent and unit-testable.
- Let application services coordinate state and operations; keep commands as serialization/adaptation boundaries.
- Avoid dependency cycles and cross-layer shortcuts.

## File and symbol naming

- Use `kebab-case` for directories and non-component TypeScript files.
- Use `PascalCase.tsx` for React component files and PascalCase for component names.
- Use `*.test.ts` or `*.test.tsx` beside the unit under test; place shared test setup in `src/test/`.
- Use `snake_case.rs` for Rust modules, `snake_case` for functions/modules, and `PascalCase` for Rust types.
- Name IPC commands and DTOs by use case, such as `inspect_media`, `RenderFastRequest`, or `OperationProgress`.
- Use stable product vocabulary across Rust, TypeScript, UI text, tests, and documentation.

## Growth rules

- Start a feature as one focused module; introduce `components/`, `hooks/`, `utils/`, or tests only when multiple files justify them.
- Avoid broad barrel exports. Add an `index.ts` only when a feature needs a deliberate public API.
- Keep generated files, media fixtures, packaged binaries, and user output out of source directories.
- Put reusable automation in `scripts/`; do not hide build logic in ad hoc shell snippets.
- Co-locate unit tests with code. Reserve root/native `tests/` for cross-module or real-process integration.
- Split a file when responsibilities diverge, not at an arbitrary line count.
- When moving a boundary, update imports, tests, rules/skills references, and architecture documentation in the same change.
