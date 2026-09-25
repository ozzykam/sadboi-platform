import { authResponse } from "@/server/auth-http";
import { inventoryStaff } from "@/server/inventory";
import { paymentFailure, storePaymentHistory } from "@/server/store-payments";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await inventoryStaff();
    return authResponse(await storePaymentHistory((await context.params).id));
  } catch (error) { return paymentFailure(error); }
}
