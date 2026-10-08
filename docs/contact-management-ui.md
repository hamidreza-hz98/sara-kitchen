# Contact-submission management UI

SK-0134 implements the localized `/dashboard/contact` inbox using the supplied light/dark contact-detail drawer as its primary design source. It reuses the dashboard shell and global theme rather than duplicating the exported navigation chrome.

## Inbox behavior

The responsive desktop table and mobile cards display sender, safe message preview, status, assignee, and received time. The URL owns page, page size, search, status, and selected-submission state, so refresh and deep links preserve context. Status controls map product language to the domain workflow: `new` is **Unread**, `in_progress` is **Open**, followed by Resolved, Spam, and Archived. Loading, empty, failure, pagination, and retry states use shared UI primitives.

## Detail and workflow

The end-side detail drawer follows the supplied screen: sender identity, direct call/email actions, message panel, lifecycle metadata, and footer actions. Authorized operators can change status, assign an active administrator, and append an attributed internal note. The supporting `/api/contacts/assignees` projection requires `contacts:update` and returns only ID, display name, and role; it never exposes login identifiers.

Archiving requires confirmation and starts the archive retention period. Permanent deletion is displayed only for Spam or Archived records, requires `contacts:delete`, and still relies on the server retention guard. The UI cannot bypass server authorization or CSRF checks.

## Content safety and accessibility

Submission messages and internal notes are inserted as React text children inside `Typography`; the UI never uses `dangerouslySetInnerHTML` or a rich-content renderer. Newlines are preserved with `white-space: pre-wrap`, long content wraps, and markup-like text remains inert. Component coverage supplies an `<img onerror>` payload and proves that no image node is created.

All controls have accessible names, the drawer has a labelled dialog boundary, status filters are keyboard-operable buttons, actions use explicit confirmation dialogs, and responsive layouts retain all workflow operations. English, Portuguese, and Persian catalogs contain structurally identical message keys.
