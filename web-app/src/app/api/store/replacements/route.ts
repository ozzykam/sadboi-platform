import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryFailure, inventoryStaff } from "@/server/inventory";
import { saveReplacement } from "@/server/order-replacements";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { const staff = await inventoryStaff(true); return authResponse(await saveReplacement(await protectedBody(request, 20000), staff), 201); }
  catch (error) { return inventoryFailure(error); }
}
