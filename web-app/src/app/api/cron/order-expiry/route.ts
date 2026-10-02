import { createHash, timingSafeEqual } from "node:crypto";
import { authResponse } from "@/server/auth-http";
import { expirePendingOrders } from "@/server/order-lifecycle";
import { paymentFailure } from "@/server/store-payments";
import { AccessError } from "@/server/staff";
import { processOrderEmails } from "@/server/order-emails";
import { processOrderRefunds } from "@/server/store-refunds";
import { processOrderDisputes } from "@/server/store-disputes";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const secret = process.env.SADBOI_EXPIRY_SECRET, supplied = request.headers.get("authorization") ?? "";
    if (!secret || secret.length < 32 || !timingSafeEqual(createHash("sha256").update(supplied).digest(), createHash("sha256").update("Bearer " + secret).digest()))
      throw new AccessError(401, "expiry-auth", "Stock expiry is not authorized.");
    const expiry = await expirePendingOrders();
    // Mail outages must not stop stock release. Inspect this result separately.
    let email;
    try { email = await processOrderEmails(); }
    catch { email = { status: "unavailable", processed: 0 }; }
    let refunds;
    try { refunds = await processOrderRefunds(); }
    catch { refunds = { status: "unavailable", processed: 0 }; }
    let disputes;
    try { disputes = await processOrderDisputes(); }
    catch { disputes = { status: "unavailable", processed: 0 }; }
    return authResponse({ ...expiry, email, refunds, disputes });
  } catch (error) { return paymentFailure(error); }
}
