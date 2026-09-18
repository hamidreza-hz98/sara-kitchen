# Reusable media picker

`MediaPicker` is exported from `@/components/media`. It is a controlled client
component: the parent form owns media IDs and stores them only when the form is
saved. The dialog browses ready media through `GET /api/media`, supports search,
kind filtering, pagination, keyboard activation, and single or multiple selection.
An optional inline image upload uses the existing guarded single-file media API.

```tsx
// Category banner, blog banner, or settings hero: one image reference.
<MediaPicker
  label="Category banner"
  allowedKinds={["image"]}
  value={bannerId}
  onChange={setBannerId}
  canUpload={canCreateMedia}
/>

// Dish gallery: multiple image references.
<MediaPicker
  label="Dish gallery"
  allowedKinds={["image"]}
  multiple
  maxItems={12}
  value={galleryIds}
  onChange={setGalleryIds}
  canUpload={canCreateMedia}
/>
```

The picker passes only IDs to the parent. Category, dish, blog, and settings
edit forms do not exist yet; their implementation tasks should connect these
controlled values to form validation, saved media references, and usage counts.
The picker does not bypass server authorization: browsing needs media read access
and inline upload needs `media:create`. Inline upload currently supports images
only, up to 3 MiB. Video/PDF items may be selected if they already exist and
the field permits their kind.
