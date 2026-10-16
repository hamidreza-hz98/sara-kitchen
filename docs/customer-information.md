# Customer information form (SK-0176)

`/profile/information` is a private, dynamic, no-store customer page. Its server component loads only the signed-in customer's safe profile projection. The form PATCHes `/api/profile` with a fresh customer CSRF token; the API revalidates all fields, checks ownership, audits the mutation, and relies on unique MongoDB indexes for mobile and non-null email conflicts. The browser never sends a customer ID or a price.

Names, Portuguese/international mobile numbers (including Persian/Arabic digits), and optional email are normalized with the same pure identity rules in browser and server. Mobile and email changes clear only their respective verification timestamps; name and consent edits preserve verification. The form displays the returned verification states and a generic 409 conflict message that does not identify another account. Marketing consent timestamps remain server-owned.

Language is intentionally **not** a customer database field: the approved launch policy stores it in the `SARA_LOCALE` browser cookie. A language-only save does not issue a profile mutation; after a successful profile mutation, the language preference is saved and the page reloads. The header selector shares this cookie writer.

No email/SMS verification sender has been approved. The form explicitly says that changing contact details makes them unverified and no code will be sent. A future verification delivery flow must be approved and integrated before these identities can be reverified; the UI must not imply that verification occurred. This does not block editing or profile access under the currently approved customer policy.

Tests cover client validation, conflict and verification feedback, normalized update payloads, server-side uniqueness, and selective clearing of verification timestamps.
