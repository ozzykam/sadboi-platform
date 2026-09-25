import { authResponse, protectedBody } from "@/server/auth-http";
import { resolvePaymentReview } from "@/server/payment-review";
import { inventoryStaff } from "@/server/inventory";
import { paymentFailure } from "@/server/store-payments";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { const staff = await inventoryStaff(true); return authResponse(await resolvePaymentReview(await protectedBody(request), staff)); }
  catch (error) { return paymentFailure(error); }
}
