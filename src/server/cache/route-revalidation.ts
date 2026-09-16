import "server-only";

import { revalidateTag } from "next/cache";

import { createContentRevalidator } from "./policy";

/** Call only after a Route Handler/job mutation has durably committed. */
export const revalidateContentFromRoute = createContentRevalidator((tag) => {
  revalidateTag(tag, { expire: 0 });
});
