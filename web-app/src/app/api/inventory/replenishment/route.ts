import { authResponse } from "@/server/auth-http";
import {
  inventoryStaff,
  inventoryFailure,
  replenishmentQueue,
} from "@/server/inventory";

export const runtime = "nodejs";
export async function GET() {
  try {
    await inventoryStaff();
    return authResponse(await replenishmentQueue());
  } catch (error) {
    return inventoryFailure(error);
  }
}
