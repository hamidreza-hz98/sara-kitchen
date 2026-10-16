import type { NextRequest } from "next/server";

import {
  assessAddressDelivery,
  loadAddressDeliveryPolicy,
} from "@/server/delivery/address-eligibility";
import { apiSuccess, handleApiRoute } from "@/server/http";
import { createAddressRepository } from "@/server/modules/addresses";

import { addressSelfRequestContext } from "../../../addresses/route-helper";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiRoute(request, async ({ requestId }) => {
    const { connection, actor } = await addressSelfRequestContext(request);
    const [addresses, policy] = await Promise.all([
      createAddressRepository(connection).listForCustomer(actor.id),
      loadAddressDeliveryPolicy(connection, requestId),
    ]);
    return apiSuccess(
      addresses.map((address) => ({
        id: address.id,
        ...assessAddressDelivery(address.location, policy),
      })),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}
