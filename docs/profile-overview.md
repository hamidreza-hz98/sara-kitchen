# Customer profile overview (SK-0175)

The overview is a private, server-rendered projection scoped to the authenticated customer ID. It is never stored in the public content cache. The route is dynamic, disables revalidation, emits `Cache-Control: private, no-store, max-age=0`, and is excluded from indexing.

- **Total orders:** count of all order records owned by the customer, including pending, failed, cancelled, and refunded orders. This is a demand/history count, not a sales count.
- **Total spent:** lifetime verified capture event cents minus verified partial/full refund event cents for the customer, using the same financial facts as dashboard net sales. Pending, failed, and merely authorized payments contribute zero. Prices sent by the browser are never used.
- **Last order:** latest owned order by immutable `createdAt DESC, _id DESC`; the card shows its saved code, status, order date, and purchase price snapshot. A pending latest order can differ from the transactions contributing to total spent.
- **Special offer:** first currently public discounted dish from the published homepage discounted section. It is optional public content and may use the existing public homepage cache; no customer data is cached with it. The section disappears when not configured, not available, or unavailable to load.

The information and address shortcuts lead to the protected routes established in SK-0174. Their editing workflows are reserved for SK-0176 and SK-0177. The orders shortcut leads to `/profile/orders` until the customer order-detail route is implemented.
