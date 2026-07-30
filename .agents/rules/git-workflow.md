# Git and pull request rule

Apply this rule to every persistent repository change.

## Topic branches are mandatory

- Never implement directly on the default branch once a baseline commit exists.
- Create a dedicated topic branch before editing. If work already exists, inspect it and preserve unrelated changes before moving the intended work to a branch.
- Use the default branch only as the PR base. Do not push directly to it or merge a topic branch locally.
- Push the topic branch and open or update a pull request for review. Use a draft PR while required checks or known work remain; mark it ready only when the quality gate passes.
- Do not force-push, rewrite shared history, or merge the PR unless the user explicitly requests it.

For a repository with no baseline commit yet, create the initial baseline first; apply topic-branch flow to subsequent changes.

## Branch names

Use:

```text
<type>/<account-name>/<ticket-id-if-known>/<title>
```

Rules:

- Allowed types: `feature`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`, `revert`.
- Use the GitHub account name; use `vakot` for the project owner.
- Lowercase and kebab-case every branch segment.
- If a ticket ID is unknown, omit that segment completely.
- Keep the title short, specific, and aligned with the PR context.

Examples:

```text
feature/vakot/initial-export-functionality-integration
feature/vakot/ec-123/initial-export-functionality-integration
fix/vakot/audio-stream-mapping
```

## Conventional commits

Use the repository's Conventional Commit shape for every commit:

```text
<type>(<scope>): <description>
```

Rules:

- Use the same allowed type vocabulary as branch names.
- Use a short lower-case scope that names the affected domain, such as `export`, `timeline`, `audio`, `media`, `tauri`, `ui`, `build`, or `rules`.
- Write a concise lower-case description in imperative or outcome-oriented form, without a trailing period.
- Keep each commit cohesive. Stage intended paths explicitly and review the staged diff before committing.
- Add a body only when the reasoning, migration, or compatibility impact is not clear from the subject.
- Use `BREAKING CHANGE:` in the footer only for an intentional incompatible contract change.

Examples:

```text
feature(export): integrate initial export functionality
fix(audio): preserve selected stream mapping
docs(rules): add repository workflow conventions
```

Use `.gitmessage` as the repository template. This project intentionally uses `feature` rather than the shorter `feat` type.

## Pull request title

Use:

```text
<type>(<context>): <[ticket-id-if-known]> <title>
```

Formatting rules:

- Omit the bracketed ticket portion and its following space when no ticket is known.
- Preserve the canonical ticket casing in the PR title, such as `[EC-123]`.
- Use sentence case for the title and no trailing period.
- Keep `context` aligned with the dominant product/technical area.

Examples:

```text
feature(export): Initial export functionality integration
feature(export): [EC-123] Initial export functionality integration
fix(audio): Preserve selected stream mapping
```

## Pull request body

Start with exactly:

```markdown
# Overview

- <ticket/design/upstream links when relevant>

<description>
```

- Delete the link bullet when no external reference exists.
- Describe why the change is needed, what changed, how it was validated, and any meaningful risk or follow-up.
- Keep the body specific to the branch diff; do not paste commit logs or generic boilerplate.
- Use `.github/pull_request_template.md` when creating the PR.
- Ensure branch type/context, commit scopes, PR title, and body tell one consistent story.

## Delivery sequence

1. Inspect worktree, current branch, remotes, and default branch.
2. Create the correctly named topic branch before implementation.
3. Implement and run the applicable quality gate.
4. Review the diff; stage only intended files.
5. Commit with the required format.
6. Push the topic branch.
7. Open a draft or ready PR with the required title/body.
8. Report branch, commits, checks, and PR URL.
