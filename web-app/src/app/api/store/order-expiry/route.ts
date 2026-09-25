import { authResponse, protectedBody } from "@/server/auth-http";
import { expirePendingOrders } from "@/server/order-lifecycle";
import { inventoryStaff } from "@/server/inventory";
import { paymentFailure } from "@/server/store-payments";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try { await inventoryStaff(true); await protectedBody(request); return authResponse(await expirePendingOrders()); }
  catch (error) { return paymentFailure(error); }
}
