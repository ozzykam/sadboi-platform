import { confirmStorePayment } from "@/server/store-orders";
import { authResponse, boundedBody } from "@/server/auth-http";
import { AccessError } from "@/server/staff";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const secret = process.env.SADBOI_PAYMENT_WEBHOOK_SECRET;
    if (!secret || request.headers.get("x-sadboi-payment-secret") !== secret)
      throw new AccessError(
        401,
        "payment-webhook",
        "Payment confirmation is not authorized.",
      );
    const body = JSON.parse(
      (await boundedBody(request, 32768)).toString("utf8"),
    );
    const { id } = await context.params;
    if (body.orderId !== id)
      throw new AccessError(
        400,
        "payment-webhook",
        "Order reference does not match the route.",
      );
    return authResponse(await confirmStorePayment(body), 200);
  } catch (error) {
    return authResponse(
      {
        error:
          error instanceof Error ? error.message : "Could not confirm payment.",
      },
      error instanceof AccessError ? error.status : 400,
    );
  }
}
