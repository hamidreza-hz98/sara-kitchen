# Right-to-left presentation

Sara Kitchen treats document direction as request state derived from the validated locale. English
and European Portuguese use `ltr`; Persian uses `rtl`. Direction is established during server
rendering, so neither hydration nor client JavaScript is required to correct the initial layout.

## Direction pipeline

The locale layout calculates direction once and supplies it to all three required presentation
layers:

1. `<html dir>` controls native layout, text flow, and portalled components such as dialogs.
2. `AppThemeProvider` selects an LTR or RTL MUI theme whose `theme.direction` matches the document.
3. `DirectionAwareCacheProvider` selects a separate Emotion cache. The RTL cache runs Stylis'
   `prefixer` followed by `stylis-plugin-rtl`; the LTR cache retains Emotion's standard processing.

The cache keys are intentionally different (`sara-mui` and `sara-mui-rtl`) so Emotion never reuses
rules generated for the opposite writing direction. Both caches preserve the App Router streaming
provider and the named MUI cascade layer.

## Authoring policy

- Prefer CSS logical properties and values: `paddingInline`, `marginInline`, `insetInlineStart`,
  `borderBlockEnd`, and `textAlign: "start" | "end"`.
- Do not infer layout direction from browser APIs or duplicate locale checks in components. Read
  `theme.direction` when a component truly needs direction-specific behavior.
- Use `DirectionalIcon` for icons whose meaning follows reading direction. The required
  `mirrorInRtl` prop makes the decision explicit at each call site.
- Mirror arrows, chevrons, previous/next navigation, undo/redo, and directional progress icons.
  Preserve logos, food, maps, clocks, media controls, checkmarks, and other intrinsic symbols.
- Use Stylis `/* @noflip */` only for a documented physical-direction exception. Prefer logical CSS
  or `DirectionalIcon` for normal application code.
- Because the root document owns `dir`, MUI portals inherit the same direction. A locally overridden
  direction must also be applied directly to any portal it opens.

## Verification

Unit and component tests lock both theme directions, both cache configurations, RTL plugin order,
and explicit icon behavior. Playwright exercises phone and wide layouts in English LTR and Persian
RTL, checks the correct server-rendered Emotion cache, verifies mirrored and fixed icons, opens a
portalled dialog to confirm logical close-button placement, rejects horizontal overflow or clipping,
and attaches a full-page screenshot for every direction/viewport pair.

Run the focused suite with:

```powershell
pnpm test:unit -- tests/unit/mui-theme.test.ts tests/component/directional-icon.test.tsx
pnpm test:e2e -- tests/e2e/direction.spec.ts
```

## References

- [MUI right-to-left support](https://mui.com/material-ui/customization/right-to-left/)
- [Emotion cache provider and custom Stylis plugins](https://emotion.sh/docs/cache-provider)
