import { authResponse, boundedBody } from "@/server/auth-http";
import { handleStripeWebhook } from "@/server/stripe-checkout";
import { paymentFailure } from "@/server/store-payments";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ accountId: string }> }) {
  try { return authResponse(await handleStripeWebhook((await context.params).accountId, await boundedBody(request, 262144), request.headers.get("stripe-signature"))); }
  catch (error) { return paymentFailure(error); }
}
