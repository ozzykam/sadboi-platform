import { authResponse, protectedBody } from "@/server/auth-http";
import { cancelPendingOrder } from "@/server/order-lifecycle";
import { inventoryStaff } from "@/server/inventory";
import { paymentFailure } from "@/server/store-payments";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { const staff = await inventoryStaff(true); return authResponse(await cancelPendingOrder(await protectedBody(request), staff)); }
  catch (error) { return paymentFailure(error); }
}
