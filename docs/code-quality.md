# Code quality gates

`pnpm verify` is the local and CI-equivalent quality gate. It checks formatting, type-aware linting,
strict compilation, positive tests, negative enforcement fixtures, architecture boundaries, and the
production build in a deterministic sequence.

## TypeScript contract

The project keeps `strict` mode and additionally enables:

- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` to model absence explicitly;
- `noImplicitReturns` and `noFallthroughCasesInSwitch` to make control flow deliberate;
- `noImplicitOverride`, `forceConsistentCasingInFileNames`, and unused-symbol checks;
- `noUncheckedSideEffectImports` to reject missing side-effect-only modules;
- `verbatimModuleSyntax` and `moduleDetection: force` for predictable ESM and type imports;
- compiler errors for unreachable code and unused labels.

Compiler exceptions must be narrow, documented, and justified by an external type defect. Do not use
`any`, broad `@ts-ignore`, or weaker compiler settings to bypass a local design problem.

## Type-aware ESLint contract

ESLint uses the TypeScript project service and treats warnings as failures. In addition to Next.js
Core Web Vitals and TypeScript recommendations, it enforces:

- all Promise-like work is awaited, returned, or explicitly handled;
- promises are not used in boolean conditions, spreads, or void-return callbacks;
- discriminated-union switches cover every member and do not hide omissions behind a default;
- type-only imports and exports use explicit `type` syntax.

## Import and runtime boundaries

The executable checker in `scripts/check-module-boundaries.mjs` enforces both domain-module rules and
top-level source direction:

- `src/server` may depend on shared constants, libraries, locales, types, and validations, never UI;
- reusable components, hooks, libraries, providers, themes, types, locales, and validations cannot
  reach into `src/app` or `src/server` outside their declared direction;
- Client Components cannot import `src/server`, `*.server.*`, server-schema modules, or modules marked
  with `server-only`;
- a dedicated file-level `use server` Server Action is the deliberate exception that Client
  Components may import;
- cross-domain dependencies still use only declared public module APIs and cannot form cycles.

Sensitive server accessors should import `server-only` even though the repository checker also
protects the layer. The framework guard catches an invalid React module graph during compilation;
the repository checker catches it earlier and applies outside React compilation too.

## Proof that gates fail closed

`pnpm test:quality` creates temporary, ignored violations and invokes the real TypeScript, ESLint, and
import-boundary commands. The suite passes only when:

1. TypeScript rejects an incompatible assignment;
2. ESLint rejects a floating promise, incomplete union switch, and value import used only as a type;
3. the boundary command rejects a Client Component importing server-only code.

Fixtures are removed in `finally` blocks and recursive cleanup verifies its resolved path remains
inside the repository's dedicated temporary prefix.
