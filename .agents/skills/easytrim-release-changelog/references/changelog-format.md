# Reusable Changelog Format

Use this reference for any EasyTrim changelog generation or historical backfill workflow. It
defines how verified changes become release-level entries; it does not define how a release range
is discovered.

## Document shape

Follow Keep a Changelog conventions while preserving the repository's existing style:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Concise user-facing outcome.

### Changed

- Concise user-facing outcome.
```

- Keep the existing introduction and historical sections unchanged unless the requested work
  explicitly requires a correction.
- Keep the next-release section above released sections.
- Use `## [Unreleased]` when no release version is supplied; do not guess a version.
- Omit empty categories and do not add decorative sections such as commit lists, contributors, or
  implementation notes.
- Use Markdown bullets with one user-facing outcome per bullet. Combine closely related technical
  changes into one outcome.
- Write concise English in plain language. Prefer the product behavior and user benefit over file
  names, commit hashes, component names, or internal architecture.
- Keep established link-reference and comparison-link conventions when the existing changelog has
  them. Do not invent issue, PR, or release links.

## Category meanings

Use only categories supported by verified evidence:

- `Added` — a new user-facing capability, supported language, workflow, or public behavior.
- `Changed` — a meaningful change to an existing user-facing behavior, interaction, layout, or
  compatibility contract.
- `Fixed` — a user-visible defect or regression that now behaves correctly.
- `Deprecated` — a user-facing feature or interface is still available but explicitly marked for
  future removal.
- `Removed` — a user-facing feature, supported behavior, or documented option no longer exists.
- `Security` — a verified security or privacy improvement with a user-visible or release-relevant
  consequence.

Do not use `Changed` as a catch-all for internal work. If a refactor, test, CI update, dependency
change, or architecture change does not alter a user-visible result, omit it. If one change has
both internal and user-facing effects, describe only the verified user-facing effect.

## Evidence standard

For every bullet, identify the final source evidence before writing it. Suitable evidence includes
changed product code, visible strings, documented behavior, release-facing configuration, or a test
that confirms a directly user-facing outcome. Commit history and merged PR descriptions can explain
intent or group related changes, but cannot substitute for source evidence.

Do not infer support, compatibility, bug fixes, security properties, or user benefits solely from
names, conventional behavior, or an unverified commit message. When evidence is incomplete, omit
the claim or state the ambiguity for the user.
