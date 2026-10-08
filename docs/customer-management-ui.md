# Customer management UI

## Route and access

`/dashboard/customers` is server-protected by `customers:read`. The page receives only explicit capability flags; hiding a control is a usability measure, while every API operation independently enforces its permission.

Direct identifiers are projected by the Customers service only for admins with `customers:read-sensitive`. Otherwise email and mobile are `null` and the interface renders a restricted label. Password data, session tokens, IP data, audit context, and order/payment internals never enter the page contract.

## List behavior

The responsive desktop table and mobile cards provide:

- debounced search and status filtering;
- stable server pagination and allow-listed sorting;
- active, disabled, and anonymized status states;
- page-sized order count, qualifying paid/completed spend in integer euro cents, and last-order time;
- URL-backed list controls and `customer=<id>` detail selection.

Order aggregates are calculated behind the Orders public module boundary. All historical orders count toward the order count, while total spend includes only `paid` and `completed` orders. This avoids coupling Customers to an order schema and avoids loading full order histories in the browser.

## Details and actions

The details drawer shows the safe customer projection, verification/consent indicators, order summary, and account timestamps. It links to the filtered orders route and the dedicated customer-address route contract. Those destination modules own their own sensitive projections and permission checks.

Account disable/reactivate requires `customers:update`; disable uses explicit confirmation and revokes sessions through the existing service. Irreversible anonymization requires `customers:delete` and a danger confirmation. The account-data export is rendered only with the dedicated `customers:read-sensitive` permission, and its API repeats that authorization check.

## Verification

Component coverage checks responsive data presentation, URL-backed detail selection, permission-hidden controls, and confirmation before disable. Unit/contract coverage checks order summary qualification, zero states, safe projections, authorization, validation, and enriched list/detail responses.
