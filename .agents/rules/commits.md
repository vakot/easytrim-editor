# Commit Guidelines

This document defines commit structure, naming, scope, and authorship rules.

## Commit Scope

Every logically independent change or addition should have its own commit.

Create a separate commit when:

- the change represents an independently understandable unit of work;
- the change could reasonably be reviewed or reverted independently;
- the user explicitly requests a separate commit.

Do not combine unrelated changes into one commit.

Do not split one logical change into unnecessary micro-commits.

A branch may contain multiple commits when the feature naturally consists of multiple logical changes.

## Commit Message Format

Use:

```text
<type>(<context>): <title>
```

Examples:

```text
feat(settings): add user preferences
fix(auth): handle expired sessions
refactor(api): simplify request handling
test(validation): cover invalid input cases
docs(readme): document local setup
build(dependencies): update build configuration
```

## Commit Types

Preferred types:

```text
feat
fix
refactor
test
docs
chore
build
ci
perf
```

Choose the type based on the change itself, not merely the branch type.

For example, a `feature/...` branch may legitimately contain:

```text
feat(...)
test(...)
docs(...)
```

commits.

## Context

`<context>` identifies the subsystem or area primarily affected by the change.

Prefer stable logical areas:

```text
notifications
events
replay
recording
windows
macos
build
cmake
tests
```

Prefer:

```text
fix(replay): preserve notification file context
```

over file-oriented contexts such as:

```text
fix(index): preserve notification file context
```

Keep the context concise.

## Title

The commit title must:

- be concise;
- describe the resulting change;
- use imperative phrasing;
- begin with lowercase where natural;
- have no trailing period.

Preferred:

```text
feat(notifications): add system notification backend
```

Avoid:

```text
feat(notifications): Added a new system notification backend.
```

## Commit Body

Do not add a commit body by default.

A normal commit consists of exactly one subject line:

```text
<type>(<context>): <title>
```

Do not add generated summaries, implementation descriptions, testing results, or explanatory paragraphs.

Such information belongs in the pull request or project documentation when required.

## Commit Cadence

Do not defer all commits until the end of a task or pull request.

For multi-step work, identify likely independently reversible units before implementation and commit them incrementally as development progresses.

Use this workflow:

1. implement one coherent unit of work;
2. run focused verification appropriate to that unit;
3. inspect the relevant diff;
4. commit that unit;
5. continue to the next independent unit.

Create the commit when the logical unit is complete. Do not continue accumulating unrelated or independently reversible work merely because it belongs to the same task or pull request.

A pull request should normally contain multiple focused commits when its implementation naturally consists of multiple logical stages.

Possible commit boundaries include:

- introducing a domain model or infrastructure;
- implementing a focused behavior;
- wiring that behavior into consumers;
- migrating an independent group of consumers;
- adding focused test coverage;
- updating documentation or project rules.

These are examples, not mandatory commit categories. Keep implementation and directly coupled tests together when separating them would produce an incomplete or misleading commit.

Prefer commits that can be independently understood, reviewed, and reverted without reverting unrelated work.

Do not implement an entire multi-part task first and split the history afterward unless the work cannot reasonably be developed incrementally.

Do not create artificial micro-commits for individual files, mechanical edits, intermediate broken states, or changes that have no independent meaning.

The goal is a development history that reflects coherent implementation steps, not the smallest possible diff per commit.

## Authorship

Every commit must have exactly one author.

Use the repository/user's configured Git identity.

Do not add automated agents as authors, co-authors, or contributors.

Never add trailers such as:

```text
Co-authored-by: Codex ...
Co-authored-by: ChatGPT ...
Generated-by: ...
```

Do not replace the user's configured Git identity with an automated-agent identity.

## Staging

A commit must contain only the changes belonging to that logical commit.

Before committing, inspect the staged diff.

If the working tree contains unrelated changes, stage only the relevant files or hunks.

Never include unrelated user-authored changes simply because they exist in the same working tree.

## Existing Commits

Once a commit has been created, treat it as immutable unless the user explicitly requests history modification.

If another correction is required, create a new logical commit.

Do not automatically:

- amend;
- squash;
- reorder;
- reword;
- rebase;
- reset existing commits.

History cleanup is performed only on explicit user request.

## Push

Creating a commit does not authorize pushing it.

After committing, leave the commit local unless the user explicitly requests a push or pull request.

Remote-operation rules are defined in `.agents/rules/git.md`.

## Before Committing

Before creating a commit:

1. verify the intended logical scope;
2. inspect the relevant diff;
3. ensure unrelated changes are excluded;
4. run appropriate verification for the affected code where practical;
5. choose the correct type, context, and concise title.

## Guiding Rule

A commit should represent one coherent, independently understandable change with a clean subject line and a single human author.
