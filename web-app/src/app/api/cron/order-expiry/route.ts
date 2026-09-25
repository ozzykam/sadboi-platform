import { createHash, timingSafeEqual } from "node:crypto";
import { authResponse } from "@/server/auth-http";
import { expirePendingOrders } from "@/server/order-lifecycle";
import { paymentFailure } from "@/server/store-payments";
import { AccessError } from "@/server/staff";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const secret = process.env.SADBOI_EXPIRY_SECRET, supplied = request.headers.get("authorization") ?? "";
    if (!secret || secret.length < 32 || !timingSafeEqual(createHash("sha256").update(supplied).digest(), createHash("sha256").update("Bearer " + secret).digest()))
      throw new AccessError(401, "expiry-auth", "Stock expiry is not authorized.");
    return authResponse(await expirePendingOrders());
  } catch (error) { return paymentFailure(error); }
}
