# Ingredients

Owns ingredient translations, media reference, allergen metadata, status, and reference-safe lifecycle rules. It may consume Media’s public API. Dishes consume ingredient public DTOs and identifiers; they never import ingredient schemas or repositories.

Ingredient names use the shared translation-array convention and require canonical English. Active
ingredients are unique by their normalized English name. Image references are nullable but, when
present, must be checked through `validateIngredientImageReference` before persistence so only an
existing, ready image is accepted. Allergen metadata uses stable EU-style codes; presentation labels
belong in locale messages rather than persisted records.
