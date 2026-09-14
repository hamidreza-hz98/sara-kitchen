# Components

Reusable React UI belongs here when it is shared by multiple routes or features.

- Put generic design-system primitives in `components/ui`.
- Put reusable layout and navigation elements in `components/layout`.
- Put domain-aware shared components in a clearly named feature folder.
- Keep route-specific components beside their route when they are not reused.
- Components are Server Components by default; add `"use client"` only at the smallest boundary that needs browser state, events, or client-only APIs.
- Do not fetch directly from MongoDB or import server modules from Client Components.

Add a barrel export only when a stable public component API exists. Avoid a single global barrel that pulls unrelated client code into bundles.
