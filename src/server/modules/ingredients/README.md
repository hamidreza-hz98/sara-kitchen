# Ingredients

Owns ingredient translations, media reference, allergen metadata, status, and reference-safe lifecycle rules. It may consume Media’s public API. Dishes consume ingredient public DTOs and identifiers; they never import ingredient schemas or repositories.

Ingredient names use the shared translation-array convention and require canonical English. Active
ingredients are unique by their normalized English name. Image references are nullable but, when
present, must be checked through `validateIngredientImageReference` before persistence so only an
existing, ready image is accepted. Allergen metadata uses stable EU-style codes; presentation labels
belong in locale messages rather than persisted records.

The module exposes repository and service APIs for list/detail/create/update/archive/restore and
soft deletion. Services enforce action-level administrator permissions, append an audit event for
every outcome, and invalidate only ingredient/detail plus dependent SEO cache tags after durable
mutations. Destructive deletion requires an archived record and a zero reference count supplied by
the Dishes public API; active or referenced ingredients remain intact.

`createIngredientAllergenCatalog()` is the read-only cross-module projection for public catalog
filtering. It exposes only matching Ingredient IDs and ID-to-allergen-code maps for published,
non-deleted ingredients; consumers never access Ingredient documents or persistence models.
