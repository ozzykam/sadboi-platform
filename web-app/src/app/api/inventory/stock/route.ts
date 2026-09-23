import { authResponse } from "@/server/auth-http";
import {
  inventoryStaff,
  inventoryFailure,
  inventoryStock,
} from "@/server/inventory";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await inventoryStaff();
    const query = new URL(request.url).searchParams;
    return authResponse(
      await inventoryStock(query.get("variant") ?? "", query.get("cursor")),
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
