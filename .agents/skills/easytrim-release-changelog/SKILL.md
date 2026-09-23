---
name: easytrim-release-changelog
description: Generate or update EasyTrim Editor's next-release CHANGELOG.md from the latest applicable release tag through the current HEAD, using verified user-facing changes and reusable Keep a Changelog rules.
---

# EasyTrim Release Changelog

Use this skill when preparing the next EasyTrim Editor release changelog. It edits only
`CHANGELOG.md` unless the user explicitly expands the scope.

Read [references/changelog-format.md](references/changelog-format.md) before writing the
changelog. That reference contains the reusable release-entry rules and is intentionally
independent from the release-range discovery workflow so a later historical backfill skill can
reuse it.

## Release range

Determine the range from the repository, rather than from the wording of a commit or PR:

1. Inspect the current branch, working tree, and `CHANGELOG.md` before changing anything.
2. List release-like tags with Git's version sort, considering both `vMAJOR.MINOR.PATCH` and
   `MAJOR.MINOR.PATCH` forms. Ignore prerelease tags unless the requested release is explicitly a
   prerelease.
3. Keep only stable semantic-version tags that are ancestors of the current `HEAD`. The newest
   such tag is the latest applicable release tag; the release range is `<tag>..HEAD`.
4. If no applicable stable tag can be determined, stop without modifying `CHANGELOG.md`. Do not
   invent a baseline, silently use an arbitrary commit, or ask interactively for one. Report that
   the release range cannot be determined.
5. If `HEAD` is the selected tag and there are no changes in the range, report that there is no
   changelog delta instead of creating empty entries.

Use the selected range for both the final source diff and supporting history. Check renames and
deletions when reviewing the diff. A useful evidence pass includes:

- `git diff --find-renames <tag>..HEAD` and the changed paths in the final source;
- first-parent and ordinary commit history in the range;
- merged PR details when GitHub access is available and the PR is part of the range;
- tests, documentation, configuration, and user-facing strings that support behavior already
  verified in production code or release-facing configuration; tests alone do not justify an
  entry.

Commit messages, PR titles, and issue descriptions are leads, not proof. Treat the final
repository diff/source as the primary source of truth. Do not describe a change that cannot be
verified in `<tag>..HEAD`.

## Changelog workflow

1. Read the existing `CHANGELOG.md` completely if it exists. Preserve its introductory text,
   release sections, links, ordering, and existing entries. Do not rewrite historical entries for
   style consistency.
2. Build a release-level change inventory from the verified diff. Consolidate related commits,
   files, and PRs into one concise user-facing entry when they describe one outcome. Do not emit a
   commit-by-commit list.
3. Exclude implementation-only work: refactors, tests, formatting, CI, dependency maintenance,
   architecture changes, internal tooling, and developer-only documentation. Include one of these
   only when the final diff verifies a material user-facing effect.
4. Write concise English entries under the applicable Keep a Changelog categories: `Added`,
   `Changed`, `Fixed`, `Deprecated`, `Removed`, and `Security`. Omit empty categories. Use the
   category meanings and wording guidance in the reusable reference.
5. Update the next-release section without inventing a version. If no next-release section exists,
   use `## [Unreleased]` at the top of the release entries, after any existing changelog
   introduction. If `[Unreleased]` already exists, update it rather than creating a duplicate.
6. Preserve existing entries when adding new evidence. Do not bump versions, create tags, create
   releases, update package metadata, or modify unrelated files.
7. Review the complete resulting `CHANGELOG.md` against the release range and confirm every entry
   has direct evidence in production code or release-facing configuration. Tests, documentation,
   user-facing strings, commits, and PRs may support that evidence but cannot justify an entry by
   themselves.

When an existing changelog establishes a different heading or link style, follow that style while
retaining the category and evidence rules in the reference. If the source evidence is ambiguous,
omit the entry or report the ambiguity instead of guessing.
