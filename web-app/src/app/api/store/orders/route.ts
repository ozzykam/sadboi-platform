import { authResponse, protectedBody } from "@/server/auth-http";
import { createStoreOrder, storeOrderCatalog } from "@/server/store-orders";
import { inventoryFailure, inventoryStaff } from "@/server/inventory";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await protectedBody(request, 32768);
    return authResponse(await createStoreOrder(body), 201);
  } catch (error) {
    return inventoryFailure(error);
  }
}
export async function GET() {
  try {
    await inventoryStaff();
    return authResponse(await storeOrderCatalog());
  } catch (error) {
    return inventoryFailure(error);
  }
}
