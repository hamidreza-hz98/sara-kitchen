import "server-only";

import { updateTag } from "next/cache";

import { createContentRevalidator } from "./policy";

/** Call only inside a Server Action, after a mutation has durably committed. */
export const revalidateContentFromAction = createContentRevalidator(updateTag);
