# Administrator permission matrix (SK-0047)

The six persisted role codes are `owner`, `manager`, `catalog_editor`, `order_operator`, `content_editor`, and `viewer`. The sole grant source is `src/constants/admin-access.ts`; this table documents its dashboard actions. `O` = owner, `M` = manager, `C` = catalog editor, `R` = order operator, `B` = content editor, `V` = viewer. A role receives only listed grants; there is no role inheritance. `read` means list/ordinary detail fields and does **not** imply `read-sensitive`.

| Permission                    | O   | M   | C   | R   | B   | V   | Dashboard action / data                                        |
| ----------------------------- | --- | --- | --- | --- | --- | --- | -------------------------------------------------------------- |
| `dashboard:view`              | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | Enter management shell                                         |
| `analytics:read`              | ✓   | ✓   | —   | —   | —   | —   | Sales and customer analytics                                   |
| `media:read`                  | ✓   | ✓   | ✓   | —   | ✓   | ✓   | List and preview media                                         |
| `media:create`                | ✓   | ✓   | ✓   | —   | ✓   | —   | Upload media                                                   |
| `media:update`                | ✓   | ✓   | ✓   | —   | ✓   | —   | Edit media metadata                                            |
| `media:delete`                | ✓   | ✓   | ✓   | —   | ✓   | —   | Delete media                                                   |
| `categories:read`             | ✓   | ✓   | ✓   | —   | ✓   | ✓   | List categories                                                |
| `categories:create`           | ✓   | ✓   | ✓   | —   | —   | —   | Create category                                                |
| `categories:update`           | ✓   | ✓   | ✓   | —   | —   | —   | Edit category                                                  |
| `categories:delete`           | ✓   | ✓   | ✓   | —   | —   | —   | Delete category                                                |
| `ingredients:read`            | ✓   | ✓   | ✓   | —   | —   | ✓   | List ingredients                                               |
| `ingredients:create`          | ✓   | ✓   | ✓   | —   | —   | —   | Create ingredient                                              |
| `ingredients:update`          | ✓   | ✓   | ✓   | —   | —   | —   | Edit ingredient                                                |
| `ingredients:delete`          | ✓   | ✓   | ✓   | —   | —   | —   | Delete ingredient                                              |
| `dishes:read`                 | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | List dishes and ordinary details                               |
| `dishes:create`               | ✓   | ✓   | ✓   | —   | —   | —   | Create dish                                                    |
| `dishes:update`               | ✓   | ✓   | ✓   | —   | —   | —   | Edit dish, price and discount                                  |
| `dishes:delete`               | ✓   | ✓   | ✓   | —   | —   | —   | Delete dish                                                    |
| `blogs:read`                  | ✓   | ✓   | —   | —   | ✓   | ✓   | List blog posts                                                |
| `blogs:create`                | ✓   | ✓   | —   | —   | ✓   | —   | Draft blog post                                                |
| `blogs:update`                | ✓   | ✓   | —   | —   | ✓   | —   | Edit blog post                                                 |
| `blogs:publish`               | ✓   | ✓   | —   | —   | ✓   | —   | Publish/unpublish post                                         |
| `blogs:delete`                | ✓   | ✓   | —   | —   | ✓   | —   | Delete post                                                    |
| `seo:read`                    | ✓   | ✓   | ✓   | —   | ✓   | ✓   | Read SEO metadata                                              |
| `seo:create`                  | ✓   | ✓   | ✓   | —   | ✓   | —   | Create static SEO entry                                        |
| `seo:update`                  | ✓   | ✓   | ✓   | —   | ✓   | —   | Edit SEO entry                                                 |
| `seo:delete`                  | ✓   | ✓   | ✓   | —   | ✓   | —   | Delete SEO entry                                               |
| `customers:read`              | ✓   | ✓   | —   | ✓   | —   | —   | List non-sensitive customer summary                            |
| `customers:read-sensitive`    | ✓   | ✓   | —   | ✓   | —   | —   | Read email, mobile and account details                         |
| `customers:create`            | ✓   | ✓   | —   | —   | —   | —   | Create customer manually                                       |
| `customers:update`            | ✓   | ✓   | —   | ✓   | —   | —   | Edit customer information                                      |
| `customers:delete`            | ✓   | —   | —   | —   | —   | —   | Delete/anonymize customer                                      |
| `addresses:read-sensitive`    | ✓   | ✓   | —   | ✓   | —   | —   | Read recipient, mobile and location                            |
| `addresses:update`            | ✓   | ✓   | —   | ✓   | —   | —   | Correct delivery address                                       |
| `addresses:delete`            | ✓   | —   | —   | —   | —   | —   | Delete saved address                                           |
| `admins:read`                 | ✓   | ✓   | —   | —   | —   | —   | List admin names and roles                                     |
| `admins:read-sensitive`       | ✓   | —   | —   | —   | —   | —   | Read admin identifiers/session metadata; never password hashes |
| `admins:create`               | ✓   | —   | —   | —   | —   | —   | Create administrator                                           |
| `admins:update`               | ✓   | —   | —   | —   | —   | —   | Edit administrator profile                                     |
| `admins:assign-role`          | ✓   | —   | —   | —   | —   | —   | Grant/change role                                              |
| `admins:disable`              | ✓   | —   | —   | —   | —   | —   | Disable administrator/revoke sessions                          |
| `admins:delete`               | ✓   | —   | —   | —   | —   | —   | Delete administrator                                           |
| `orders:read`                 | ✓   | ✓   | —   | ✓   | —   | —   | List codes, statuses and totals                                |
| `orders:read-sensitive`       | ✓   | ✓   | —   | ✓   | —   | —   | Read customer, delivery and item detail                        |
| `orders:create`               | ✓   | ✓   | —   | ✓   | —   | —   | Create manual order                                            |
| `orders:update`               | ✓   | ✓   | —   | ✓   | —   | —   | Update status/fulfillment                                      |
| `orders:cancel`               | ✓   | ✓   | —   | ✓   | —   | —   | Cancel order                                                   |
| `orders:export`               | ✓   | ✓   | —   | ✓   | —   | —   | Export order/invoice PDF                                       |
| `transactions:read`           | ✓   | ✓   | —   | ✓   | —   | —   | List payment status and amount                                 |
| `transactions:read-sensitive` | ✓   | ✓   | —   | ✓   | —   | —   | Read gateway/payment identifiers; never raw credentials        |
| `transactions:create`         | ✓   | —   | —   | —   | —   | —   | Initiate manual transaction                                    |
| `transactions:reconcile`      | ✓   | ✓   | —   | ✓   | —   | —   | Reconcile gateway result                                       |
| `transactions:refund`         | ✓   | —   | —   | —   | —   | —   | Record/execute refund (phone-led MVP)                          |
| `contacts:read`               | ✓   | ✓   | —   | ✓   | —   | —   | List contact summaries                                         |
| `contacts:read-sensitive`     | ✓   | ✓   | —   | ✓   | —   | —   | Read message, mobile and name                                  |
| `contacts:delete`             | ✓   | ✓   | —   | —   | —   | —   | Delete contact submission                                      |
| `logs:read`                   | ✓   | ✓   | —   | —   | —   | —   | Read audit activity and actor identifiers                      |
| `settings:read`               | ✓   | ✓   | —   | —   | ✓   | ✓   | Read public-facing settings                                    |
| `settings:read-sensitive`     | ✓   | —   | —   | —   | —   | —   | Read security/private operational configuration                |
| `settings:update-content`     | ✓   | ✓   | —   | —   | ✓   | —   | Homepage, about, FAQ, terms, socials                           |
| `settings:update-operations`  | ✓   | ✓   | —   | —   | —   | —   | Contact, delivery and locale operations                        |
| `settings:update-security`    | ✓   | —   | —   | —   | —   | —   | Security/session configuration                                 |

Customer self-service is a separate authorization audience: a customer may access only their own profile, addresses, carts, orders and payments. No admin role grants access to customer password hashes or gateway secrets. System-originated operations (audit append, webhook processing, automatic SEO generation) authenticate as dedicated system workflows; no dashboard grant is inferred from them.

Server routes and actions must resolve an **active** admin from a verified admin session, then call `requireAdminPermission(actor, permission)` before data access or mutation. List endpoints must project out sensitive fields unless the matching `read-sensitive` grant is also checked. Client navigation filtering is only a usability aid and never an authorization boundary. Unknown roles, disabled accounts, missing permissions, and cross-audience sessions fail closed. Enforcement at actual admin routes is deferred to SK-0048–SK-0052 because those routes remain blocked until session infrastructure exists.
