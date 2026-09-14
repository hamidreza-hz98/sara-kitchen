# Module implementation blueprint

This is documentation, not a runnable domain module. Copy the structure selectively when implementing a real module; create a file only when it contains a real contract or behavior.

```text
<module>/
├── index.ts                         # the only public import surface
├── README.md                        # ownership, invariants, dependencies
├── model/
│   ├── <entity>.schema.ts           # private Mongoose schema/model registration
│   └── <entity>.types.ts            # persistence-only types when needed
├── repository/
│   └── <entity>.repository.ts       # private persistence/query implementation
├── service/
│   └── <operation>.service.ts       # use cases and transaction boundaries
├── policy/
│   └── <operation>.policy.ts        # authorization/ownership decisions
├── validation/
│   └── <operation>.schema.ts        # untrusted-input validation/normalization
├── mapper/
│   └── <entity>.mapper.ts           # persistence/domain/public DTO mapping
└── __tests__/
    ├── <operation>.test.ts          # unit behavior and invariants
    └── <module>.integration.test.ts # database/integration behavior
```

## Layer direction

1. Validation parses external input into trusted command/query values.
2. Policy decides whether the authenticated actor may perform the operation.
3. Service coordinates the use case and owns business/transaction rules.
4. Repository is the only normal path from a service to its module’s model.
5. Model/schema owns persistence invariants, indexes, and registration.
6. Mapper converts persistence/domain values to explicit public DTOs.
7. Tests may reach private layers inside their own module but never another module’s internals.

The public `index.ts` exports use-case functions and public DTO/input types only. It must not export Mongoose models, schemas, repository implementations, provider secrets, or test helpers.
