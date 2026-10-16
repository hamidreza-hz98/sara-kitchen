# Customer profile shell (SK-0174)

`/profile` and every nested page are guarded by the customer session on the server. Anonymous visitors are redirected to `/login` with a validated `returnTo` containing the requested profile path and query; login returns them there after the session cookie has been set. The validator permits only `/profile` descendants and the existing `/cart/address` handoff. External URLs, fragments, control characters, and unrelated paths fall back to `/profile`.

The shared shell renders overview, information, addresses, orders, security/sessions, and sign-out navigation. At desktop widths it is a side rail; on small screens the same links form a horizontally scrollable row. The selected route has `aria-current="page"`, including the password-change child under security. Sign-out uses the protected customer logout endpoint and synchronizes auth state across tabs.

The information and addresses routes are intentionally only landing points in this task. Their data forms belong to SK-0176 and SK-0177; the profile overview metrics belong to SK-0175. Profile pages are private and should never be publicly cached or indexed.
