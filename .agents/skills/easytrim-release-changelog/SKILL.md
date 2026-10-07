---
name: easytrim-release-changelog
description: Maintain EasyTrim Editor's CHANGELOG.md for pull-request [Unreleased] checks or release preparation, using verified user-facing changes and reusable Keep a Changelog rules.
---

# EasyTrim Release Changelog

Use this skill when maintaining EasyTrim Editor's `[Unreleased]` section during pull-request
review or when preparing/reconciling a release changelog. It edits only `CHANGELOG.md` unless
the user explicitly expands the scope.

Read [references/changelog-format.md](references/changelog-format.md) before writing the
changelog. That reference contains the reusable release-entry rules and is intentionally
independent from the release-range discovery workflow so a later historical backfill skill can
reuse it.

## Scope selection

Select exactly one scope from the invocation context before inspecting a range:

- **PR scope** applies when this skill is invoked by the pull-request workflow or the request
  explicitly asks for current PR changelog maintenance. Resolve the current PR's base branch and
  head, verify that the head is the current worktree `HEAD`, and analyze only the PR diff against
  its base (the merge-base range `<base>...HEAD`). Preserve existing `[Unreleased]` entries from
  the base and add or update only entries attributable to this PR. Do not reconcile unrelated
  changes already present on the base branch. If the PR context or local base ref cannot be
  determined, stop without modifying `CHANGELOG.md` and report the missing context.
- **Release scope** applies when the request explicitly asks for release preparation or release
  reconciliation. Determine the release range using the rules below.

Do not infer one scope from the other, silently default to release scope, or combine both scopes
in one invocation. If the invocation does not select exactly one scope, stop without modifying
`CHANGELOG.md` and report that the scope must be explicit.

## Release-state delta

A changelog describes the user-visible state delta between release boundaries, not the chronology
of work during development. Before creating a `Changed`, `Fixed`, `Removed`, or similar entry,
determine whether the affected behavior existed in the latest stable released version. The final
changelog describes the state users will receive when upgrading from that release.

If a feature was introduced during the current unreleased cycle and then modified, renamed, moved,
fixed, or refactored before release, do not add another entry for that intermediate transition.
Update or consolidate its existing entry to describe its final shipped state. Consolidation is
based on user-facing outcome, not on code area, feature family, PR, or implementation timeline.
Multiple distinct changes in the same UI area should remain separate when users would notice or
describe them independently. For example, adding a Settings dialog, changing the Command Center
shortcut, adding a Settings shortcut, changing the View menu, and removing a Queue menu are
separate outcomes; renaming or rearranging pages and refining controls inside the new dialog are
development steps toward its final state. Do not optimize for the minimum possible number of
bullets. Optimize for the minimum number required to accurately describe the meaningful release
delta. A `Fixed` entry is appropriate for a defect that existed in a previously released version,
unless another exceptional user-facing reason justifies calling it out. Apply the same rule to
`Changed` and `Removed`: do not describe lifecycle transitions of behavior users have never received.

For release scope, compare the complete `[Unreleased]` section with the latest stable release tag
and remove development-only transitions from the section. For PR scope, the PR base is an
attribution boundary, not necessarily the previous user-visible state: it may contain unreleased
features. Use the latest stable release tag as timeline context (`release → existing Unreleased
work → current PR`). If a PR only refines a feature introduced since that tag, update or consolidate
its existing `[Unreleased]` entry instead of adding a new `Fixed` or `Changed` bullet. Still limit
PR-scope edits to entries related to that PR; do not rewrite unrelated changelog content.

## Release scope

The following release-range rules apply only after release scope has been selected. They do not
apply to PR scope.

### Release range

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

## Shared evidence rules

Use the selected scope range for both the final source diff and supporting history. In PR scope,
the range is `<base>...HEAD`; in release scope, it is `<tag>..HEAD`. Check renames and deletions
when reviewing the diff. A useful evidence pass includes:

- the selected scope diff (`git diff --find-renames <base>...HEAD` for PR scope or
  `git diff --find-renames <tag>..HEAD` for release scope) and its changed paths;
- first-parent and ordinary commit history in the range;
- merged PR details when GitHub access is available and the PR is part of the range;
- tests, documentation, configuration, and user-facing strings that support behavior already
  verified in production code or release-facing configuration; tests alone do not justify an
  entry.

Commit messages, PR titles, and issue descriptions are leads, not proof. Treat the final
repository diff/source as the primary source of truth. Do not describe a change that cannot be
verified in the selected scope range.

## Changelog workflow

1. Read the existing `CHANGELOG.md` completely if it exists. Preserve its introductory text,
   release sections, links, ordering, and existing entries. Do not rewrite historical entries for
   style consistency.
2. Build a change inventory from the verified scope diff. In release scope, consolidate related
   commits, files, and PRs only when they produce the same user-facing outcome. In PR scope,
   consolidate only work introduced by the current PR and only when it produces the same outcome.
   Consolidation is based on user-facing outcome, not code area, feature family, PR, or development
   timeline. Preserve distinct changes users would notice or describe independently, even when they
   affect the same UI or feature. Do not optimize for the minimum possible number of bullets;
   include the minimum number required to accurately describe the meaningful release delta. Do not
   emit a commit-by-commit list.
3. Exclude implementation-only work: refactors, tests, formatting, CI, dependency maintenance,
   architecture changes, internal tooling, and developer-only documentation. Include one of these
   only when the final diff verifies a material user-facing effect.
4. Write concise English entries under the applicable Keep a Changelog categories: `Added`,
   `Changed`, `Fixed`, `Deprecated`, `Removed`, and `Security`. Omit empty categories. Use the
   category meanings and wording guidance in the reusable reference.
5. Update the `[Unreleased]` section without inventing a version. If no section exists, use
   `## [Unreleased]` at the top of the release entries, after any existing changelog
   introduction. If `[Unreleased]` already exists, update it rather than creating a duplicate.
   In PR scope, change only entries attributable to the current PR and leave unrelated base
   entries untouched. In release scope, reconcile the complete `[Unreleased]` section against the
   selected release range.
6. Preserve existing entries when adding new evidence. Do not bump versions, create tags, create
   releases, update package metadata, or modify unrelated files.
7. Review the resulting `[Unreleased]` section against the selected scope and confirm every entry
   has direct evidence in production code or release-facing configuration. Tests, documentation,
   user-facing strings, commits, and PRs may support that evidence but cannot justify an entry by
   themselves. In release scope, also confirm the complete section is reconciled against the
   selected release range.

When an existing changelog establishes a different heading or link style, follow that style while
retaining the category and evidence rules in the reference. If the source evidence is ambiguous,
omit the entry or report the ambiguity instead of guessing.
