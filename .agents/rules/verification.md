# Verification

Use [docs/development.md](../../docs/development.md) for the repository's commands. This file
defines agent verification policy rather than duplicating command documentation.

## Required discipline

- Inspect the complete final diff and confirm every change is intentional and in scope.
- Run relevant formatting, linting, type, test, static-analysis, build, and native checks where
  practical for the affected area.
- Never claim an unexecuted check passed. Distinguish failures caused by the change from
  pre-existing, unrelated, or environment-specific failures.
- Report unavailable checks and environment limitations explicitly; do not weaken verification to
  work around them.
- Inspect final `git status`, branch, staging state, and changed paths. Preserve unrelated user
  work and avoid temporary/generated files.

## Documentation-only changes

For documentation work, verify Markdown formatting, relative links, referenced paths and commands,
ownership/duplication consistency, and that no implementation files changed. Application builds and
runtime tests are not required unless the documentation affects executable/generated output.

## Reporting

Report checks factually and concisely, including checks not run. Review substantial changes as a
pull request before completion and fix issues found during that review.
