import { authResponse, protectedBody } from "@/server/auth-http";
import { accessOrder } from "@/server/order-access";
import { paymentFailure } from "@/server/store-payments";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return authResponse(await accessOrder((await context.params).id, await protectedBody(request))); }
  catch (error) { return paymentFailure(error); }
}
