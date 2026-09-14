# Formatting and Git hooks

Formatting and staged checks are deterministic repository policy, not editor preferences.

## Line endings and formatting

- `.gitattributes` normalizes text to LF in Git and explicitly marks common assets as binary.
- `.editorconfig` gives editors UTF-8, LF, final-newline, whitespace, and two-space indentation rules.
- `.prettierrc.json` is the executable formatting contract: LF endings, 100-column lines, semicolons,
  double quotes, and trailing commas.
- `.prettierignore` excludes generated output, dependencies, reports, the lockfile, and TypeScript
  build metadata. The lockfile is generated only by the pinned pnpm version.

Use `pnpm format` to format the repository and `pnpm format:check` for a read-only verification.
Avoid formatting unrelated files as part of a focused change.

## Pre-commit behavior

Husky runs `lint-staged --concurrent false` before every normal commit. Serialized execution makes
the outcome independent of task timing. `lint-staged` temporarily protects unstaged changes and
passes only staged, supported files to these commands:

- JavaScript and TypeScript: zero-warning ESLint fixes, followed by Prettier;
- JSON, YAML, Markdown, CSS, SCSS, and HTML: Prettier.

Fixable changes are restaged into the proposed commit. Syntax errors and non-fixable lint errors
reject the commit. Unstaged and unrelated files must retain their original content.

Do not bypass the hook with `--no-verify` during normal development. An exceptional bypass requires
a documented reason and a successful `pnpm verify` before the commit is shared or deployed.

## Executable acceptance test

`pnpm test:hooks` initializes a disposable nested Git repository and uses the real Husky hook and
lint-staged configuration. It proves that malformed staged TypeScript cannot be committed, valid
staged TypeScript is formatted and committed, and an unrelated unstaged document stays byte-for-byte
unchanged. The fixture is ignored and safely removed in a `finally` block.
