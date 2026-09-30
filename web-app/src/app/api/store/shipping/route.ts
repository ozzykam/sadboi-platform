import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryFailure, inventoryStaff } from "@/server/inventory";
import { shippingSettings, saveShippingSettings } from "@/server/shipping";
export const runtime = "nodejs";
export async function GET() {
  try { await inventoryStaff(); return authResponse(await shippingSettings()); }
  catch (error) { return inventoryFailure(error); }
}
export async function POST(request: Request) {
  try { const staff = await inventoryStaff(true); return authResponse(await saveShippingSettings(await protectedBody(request), staff)); }
  catch (error) { return inventoryFailure(error); }
}
