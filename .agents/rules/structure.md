# Repository structure rule

Canonical EasyTrim architecture, ownership, dependency direction, and file-placement guidance is
documented in [docs/architecture.md](../../docs/architecture.md). Apply that document when
creating, moving, or reviewing modules.

Agents must enforce these boundaries:

- Keep `apps/desktop` as the coupled React/Tauri application; add workspace packages only for a
  stable contract with at least two consumers.
- Keep application composition and cross-feature orchestration in `app/`, capability code in
  `features/`, shared primitives in `components/ui/`, pure shared product logic in `domain/`, and
  technical adapters in `lib/`.
- Use the public `index.ts` API of another feature; never import its internals or create cycles.
- Keep Tauri runtime types at native command/entrypoint boundaries and use typed frontend adapters.
- Grow directories and abstractions only when they own a real responsibility.

The [code conventions](../../docs/code-conventions.md), [state management](../../docs/state-management.md),
and [runtime/security](../../docs/runtime-security.md) documents define related boundaries.
