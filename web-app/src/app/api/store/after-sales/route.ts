import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryFailure, inventoryStaff } from "@/server/inventory";
import { orderAfterSales } from "@/server/store-after-sales";
import { requestOrderRefund, refreshOrderRefunds } from "@/server/store-refunds";
import { receiveOrderReturn } from "@/server/store-returns";
import { AccessError } from "@/server/staff";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try { await inventoryStaff(); return authResponse(await orderAfterSales(new URL(request.url).searchParams.get("orderId") ?? "")); }
  catch (error) { return inventoryFailure(error); }
}
export async function POST(request: Request) {
  try {
    const staff = await inventoryStaff(true), body = await protectedBody(request, 16384);
    const { action, ...input } = body;
    if (action === "refund") return authResponse(await requestOrderRefund(input, staff), 201);
    if (action === "receive") return authResponse(await receiveOrderReturn(input, staff), 201);
    if (action === "refresh" && Object.keys(input).length === 1 && typeof input.orderId === "string") return authResponse(await refreshOrderRefunds(input.orderId));
    throw new AccessError(400, "after-sales", "Choose a valid after-sales action.");
  } catch (error) { return inventoryFailure(error); }
}
