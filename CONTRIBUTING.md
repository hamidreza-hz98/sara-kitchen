# Contributing to Sara Kitchen

This document defines the working agreement for the Sara Kitchen repository. It applies to developers, AI-assisted development, maintenance work, and production releases.

## Branch policy

The project currently uses one branch only: `master`.

- Commit all development directly to `master`.
- Do not create feature, release, or temporary branches unless the project owner changes this policy.
- Pull/rebase the latest remote state before pushing once a remote repository exists.
- Never force-push, delete, or rewrite `master` without explicit approval from the project owner.
- Keep commits small, coherent, and independently understandable even though work is performed on one branch.
- Do not commit generated build output, dependency directories, local environment files, credentials, or secrets.

When the GitHub repository is connected, protect `master` against deletion and force pushes. The single-branch decision means pull-request review is not required during the current solo-development phase.

## Commit messages

Use Conventional Commits:

```text
<type>(optional-scope): <imperative summary>
```

Allowed primary types:

- `feat`: introduce user-visible functionality.
- `fix`: correct faulty behavior.
- `refactor`: restructure code without changing behavior.
- `perf`: improve performance.
- `test`: add or correct tests.
- `docs`: change documentation only.
- `style`: change presentation or formatting without changing behavior.
- `build`: change dependencies or build tooling.
- `ci`: change continuous integration or deployment automation.
- `chore`: perform repository maintenance not covered above.
- `revert`: revert an earlier commit.

Rules:

- Write the summary in English, use imperative mood, begin in lowercase, and omit the trailing period.
- Keep the first line concise; target 72 characters or fewer.
- Add a body when the reason, trade-off, migration, or operational effect is not obvious.
- Add `BREAKING CHANGE:` in the footer when a change requires migration or intentionally breaks a public contract.
- Reference the relevant Sara Kitchen task ID in the body or footer when practical, for example `Task: SK-0011`.

Examples:

```text
feat(cart): add quantity validation
fix(auth): revoke expired admin sessions
docs: establish repository contribution policy
```

## Change discipline

Before committing:

1. Confirm the change belongs to the active task.
2. Preserve unrelated user work and avoid broad mechanical changes without a reason.
3. Review `git diff` for accidental files, secrets, debug output, and generated artifacts.
4. Run the checks relevant to the change.
5. Update documentation, translations, tests, and the master task list when the task requires them.

The complete local verification command is:

```powershell
pnpm verify
```

This runs formatting checks, type-aware ESLint, strict TypeScript checking, unit tests, the live
import-boundary scan, negative quality-gate fixtures, and the production build. Run focused
Playwright or integration suites when the affected behavior requires them. A commit may not
knowingly leave the repository with failing required checks.

The Husky pre-commit hook runs `lint-staged`. Staged source files are linted and formatted, while
staged configuration, styles, and documentation are formatted. Hooks are a fast local safeguard;
they do not replace `pnpm verify` or CI.

## Production approval

Committing to `master` does not authorize or automatically trigger a production release.

Before production deployment:

- the working tree must be clean;
- required lint, type, test, build, security, migration, and smoke checks must pass;
- staging acceptance must pass for the affected flows;
- database migrations, rollback steps, and operational impact must be documented when relevant;
- Chef Sara Kazemi or the explicitly delegated project owner must approve the release;
- the released commit must be identified by an immutable Git tag or deployment revision.

Production credentials must stay in the deployment provider’s secret store. They must never be placed in commits, issue text, logs, screenshots, AI prompts, or chat messages.

## Temporary nature of this policy

The one-branch workflow is an explicit early-development decision. Revisit it before adding multiple regular contributors or enabling automatic production deployment. Any replacement policy must update this file and the master task list in the same change.
