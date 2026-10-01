import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryFailure, inventoryStaff } from "@/server/inventory";
import { shipmentCaseHistory, saveShipmentCase } from "@/server/shipment-cases";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { await inventoryStaff(); return authResponse(await shipmentCaseHistory(new URL(request.url).searchParams.get("orderId") ?? "")); }
  catch (error) { return inventoryFailure(error); }
}
export async function POST(request: Request) {
  try { const staff = await inventoryStaff(true); return authResponse(await saveShipmentCase(await protectedBody(request, 20000), staff), 201); }
  catch (error) { return inventoryFailure(error); }
}
