# Components

Shared application components belong here. Import them through `@/components`.

- `DirectionalIcon` requires an explicit `mirrorInRtl` decision. Use `true` for arrows, chevrons,
  undo/redo, and other icons whose meaning follows reading direction; use `false` for brand marks,
  media controls, maps, clocks, and other icons with an intrinsic orientation.
- `ui/` exposes the stable product primitives for actions, navigation, form controls, overlays,
  indicators, loading/state feedback, pagination, optimized images, and structured rich content.
  Their contracts and accessibility requirements are documented in `docs/ui-primitives.md`.

Reusable React UI belongs here when it is shared by multiple routes or features.

- Put generic design-system primitives in `components/ui`.
- Put reusable layout and navigation elements in `components/layout`.
- Put domain-aware shared components in a clearly named feature folder.
- Keep route-specific components beside their route when they are not reused.
- Components are Server Components by default; add `"use client"` only at the smallest boundary that needs browser state, events, or client-only APIs.
- Do not fetch directly from MongoDB or import server modules from Client Components.

The `ui` barrel is the approved public API. It keeps server-capable primitives free of client
directives and isolates interactive overlay behavior in the smallest client module. Avoid importing
implementation files directly or adding a client directive to the global component barrel.
