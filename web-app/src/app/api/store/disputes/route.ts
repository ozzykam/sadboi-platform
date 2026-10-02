import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryFailure, inventoryStaff } from "@/server/inventory";
import { disputeCommandSchema } from "@sadboi/core";
import { AccessError } from "@/server/staff";
import { orderDisputeHistory, refreshOrderDisputes, saveDisputeNote } from "@/server/store-disputes";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { await inventoryStaff(); return authResponse(await orderDisputeHistory(new URL(request.url).searchParams.get("orderId") ?? "")); }
  catch (error) { return inventoryFailure(error); }
}
export async function POST(request: Request) {
  try {
    const staff = await inventoryStaff(true), parsed = disputeCommandSchema.safeParse(await protectedBody(request, 20000));
    if (!parsed.success) throw new AccessError(400, "order-dispute", "Invalid dispute command.");
    if (parsed.data.action === "refresh") return authResponse(await refreshOrderDisputes(parsed.data.orderId));
    const { orderId, id, operationId, expectedRevision, input } = parsed.data;
    return authResponse(await saveDisputeNote({ orderId, id, operationId, expectedRevision, input }, staff), 201);
  } catch (error) { return inventoryFailure(error); }
}
