# Tests

Cross-feature and system-level test support belongs here.

Planned organization:

- `tests/integration`: module and persistence integration tests.
- `tests/contract`: Route Handler and external integration contracts.
- `tests/e2e`: Playwright customer and administration journeys.
- `tests/fixtures`: deterministic, non-sensitive test builders and media fixtures.
- `tests/helpers`: test-only infrastructure with no production imports flowing back from application code.

Focused unit and component tests may be colocated with the source they exercise. Tests must be deterministic, isolated, and safe to run against non-production resources only.
