import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryStaff, inventoryFailure } from "@/server/inventory";
import { commissionDirectory, commissionDetail, saveCommission } from "@/server/commissions";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await inventoryStaff(); const params = new URL(request.url).searchParams;
    return authResponse(params.has("id") || params.has("kind") ? await commissionDetail(params.get("kind"), params.get("id")) : await commissionDirectory());
  } catch (error) { return inventoryFailure(error); }
}
export async function POST(request: Request) {
  try { const staff = await inventoryStaff(true); return authResponse(await saveCommission(await protectedBody(request, 524288), staff), 201); }
  catch (error) { return inventoryFailure(error); }
}
