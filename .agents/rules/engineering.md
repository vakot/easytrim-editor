# Engineering rule

Apply this rule to every repository change.

## Work from explicit contracts

- Treat accepted product decisions and repository contracts as the source of truth.
- Preserve the one-screen, in-memory-only scope unless the user explicitly expands it.
- Identify affected boundaries before editing: React UI, Tauri IPC, Rust domain/application logic, FFmpeg behavior, or packaging.
- Update every affected contract in the same change. Do not leave Rust DTOs, TypeScript types, UI labels, tests, and documentation inconsistent.
- Prefer the smallest complete implementation over speculative abstractions or future-facing framework layers.

## Keep code maintainable

- Give each module one clear responsibility and one reason to change.
- Prefer explicit data flow, typed requests/results, pure transformations, and small adapters at framework boundaries.
- Represent invalid or contradictory states so they are difficult to construct.
- Keep derived values derived; do not duplicate them in mutable state.
- Use names that communicate product meaning. Avoid catch-all names such as `utils`, `helpers`, `common`, `manager`, or `misc` when a narrower domain name exists.
- Comment decisions, invariants, and surprising constraints. Do not narrate obvious syntax.
- Remove obsolete code and documentation when replacing behavior; do not retain commented-out implementations.

## Manage dependencies deliberately

- Use the existing standard library or dependency set when it solves the problem clearly.
- Add a dependency only when it materially improves correctness, security, interoperability, or maintenance.
- Verify current official documentation and compatibility with the locked toolchain before selecting a package.
- Pin through the normal lockfile and record any required license or redistribution notice.
- Do not add overlapping libraries for state, styling, process execution, parsing, or testing without a concrete need.

## Handle errors as product behavior

- Validate at trust boundaries and return structured, actionable errors.
- Preserve bounded diagnostic details for troubleshooting without exposing unnecessary paths or secrets.
- Never swallow errors, convert failure into success, or silently change codec, quality, stream selection, output location, or persistence behavior.
- Make cancellation, source replacement, retries, and partial helper failure explicit state transitions.
- Reserve panics and assertions for impossible internal invariants; user input and external process failure must return errors.

## Keep the repository reviewable

- Keep TypeScript strict and Rust idiomatic.
- Explain non-obvious Rust ownership, concurrency, and Tauri security choices in review notes.
- Update the relevant rule or contract only when product or architectural policy actually changes.
- Do not add auxiliary documentation that duplicates rules, skills, code comments, or the plan.
- Do not leave unresolved placeholders, TODO error handling, dead feature flags, or knowingly skipped required tests in completed work.
