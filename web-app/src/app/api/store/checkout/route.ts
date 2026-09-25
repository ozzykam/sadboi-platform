import { authResponse, protectedBody } from "@/server/auth-http";
import { startStripeCheckout } from "@/server/stripe-checkout";
import { paymentFailure } from "@/server/store-payments";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { return authResponse(await startStripeCheckout(await protectedBody(request))); }
  catch (error) { return paymentFailure(error); }
}
