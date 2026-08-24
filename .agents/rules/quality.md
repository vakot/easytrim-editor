# Quality gate rule

Apply this rule before declaring any implementation or refactor complete.

## Definition of done

- Behavior matches every applicable domain contract and accepted product decision.
- New behavior and important failure paths have tests at the lowest useful layer.
- Formatting, linting, type checking, compilation, and applicable tests pass.
- Cross-boundary DTOs, UI states, error codes, and documentation agree.
- No placeholder behavior, silent fallback, leaked listener/process, accidental persistence, or unbounded output remains.

## Frontend gate

Expected scripts:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

- Run `tsc --noEmit` separately because Vite transpilation is not type checking.
- Keep strict TypeScript enabled. Use `unknown` at untrusted boundaries and narrow it; do not introduce `any`.
- Test observable behavior with Vitest, Testing Library, and user-event.
- Prefer focused assertions over large snapshots.
- Cover listener cleanup, stale async completions, cancellation, keyboard interaction, and accessibility for changed editor flows.

## Native gate

Expected commands:

```text
cargo fmt --all -- --check
cargo check --all-targets
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets
```

- Keep stable Rust pinned with `rust-toolchain.toml` and commit `Cargo.lock`.
- Avoid `unwrap`/`expect` outside tests or provably fatal bootstrap.
- Do not add `unsafe` without documented necessity and a focused test.
- Unit-test pure validation, state transitions, command builders, parsing, and error mapping.
- Integration-test child failure, cancellation, concurrent pipes, Unicode/space paths, and cleanup with deterministic fixtures or fake executables.

## Media gate

- Generate tiny deterministic and redistributable media fixtures where practical.
- Probe outputs with FFprobe; a zero FFmpeg exit code is not sufficient.
- Assert stream counts/index mapping, copy versus encode behavior, dimensions, frame-rate policy, duration tolerance, audio selection/merge, and output readability.
- Cover no/one/multiple audio streams, VFR/fractional rates, keyframe and near-EOF trims, rotation, incompatible containers, NVENC unavailable paths, and malformed custom arguments when relevant.
- Record benchmark source characteristics, command/preset, elapsed time, reported speed, and output size. Never generalize one sample into a hardware guarantee.

## Proportional verification

- During iteration, run the narrowest fast checks that cover the change.
- Before handoff, run every applicable full gate above.
- If a script is expected but missing during bootstrap, create it or report the exact bootstrap gap.
- If a toolchain or binary is unavailable, report the missing executable and list checks not run.
- Never claim a check passed when it was skipped, unavailable, or inferred from a different layer.

## Handoff

- Summarize behavior and contracts changed.
- Report exact commands run and results.
- Call out remaining risks, unverified platform/media cases, new dependencies, capability changes, or packaging/license impact.
- Explain Rust/Tauri decisions in plain language when native code changed.
