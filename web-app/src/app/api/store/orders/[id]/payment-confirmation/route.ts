import { createHash, timingSafeEqual } from "node:crypto";
import { confirmStorePayment, paymentFailure } from "@/server/store-payments";
import { authResponse, boundedBody } from "@/server/auth-http";
import { AccessError } from "@/server/staff";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const secret = process.env.SADBOI_PAYMENT_WEBHOOK_SECRET;
    const supplied = request.headers.get("x-sadboi-payment-secret");
    if (!secret || !supplied || !timingSafeEqual(
      createHash("sha256").update(supplied).digest(),
      createHash("sha256").update(secret).digest(),
    ))
      throw new AccessError(
        401,
        "payment-webhook",
        "Payment confirmation is not authorized.",
      );
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
      throw new AccessError(415, "content-type", "JSON is required.");
    const bytes = await boundedBody(request, 32768);
    let body: unknown;
    try { body = JSON.parse(bytes.toString("utf8")); }
    catch { throw new AccessError(400, "invalid-payment", "Invalid payment confirmation payload."); }
    const { id } = await context.params;
    if (!body || typeof body !== "object" || Array.isArray(body) || !("orderId" in body) || body.orderId !== id)
      throw new AccessError(
        400,
        "payment-webhook",
        "Order reference does not match the route.",
      );
    return authResponse(await confirmStorePayment(body), 200);
  } catch (error) {
    return paymentFailure(error);
  }
}
