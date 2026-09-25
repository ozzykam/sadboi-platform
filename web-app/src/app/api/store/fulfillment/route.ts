import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryFailure, inventoryStaff } from "@/server/inventory";
import { saveFulfillment } from "@/server/fulfillment";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const staff = await inventoryStaff(true);
    const body = await protectedBody(request, 32768);
    return authResponse(await saveFulfillment(body, staff), 201);
  } catch (error) {
    return inventoryFailure(error);
  }
}
