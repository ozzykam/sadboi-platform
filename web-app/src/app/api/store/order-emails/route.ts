import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryFailure, inventoryStaff } from "@/server/inventory";
import { orderEmailHistory, processOrderEmails, retryOrderEmail } from "@/server/order-emails";
import { AccessError } from "@/server/staff";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try { await inventoryStaff(); return authResponse(await orderEmailHistory(new URL(request.url).searchParams.get("orderId"))); }
  catch (error) { return inventoryFailure(error); }
}
export async function POST(request: Request) {
  try {
    const staff = await inventoryStaff(true), body = await protectedBody(request);
    if (body.action === "retry") await retryOrderEmail(body, staff);
    else if (body.action !== "process") throw new AccessError(400, "email-action", "Choose a valid email action.");
    // Also validates the order and never accepts an arbitrary recipient/body.
    await orderEmailHistory(body.orderId);
    return authResponse(await processOrderEmails(String(body.orderId)));
  } catch (error) { return inventoryFailure(error); }
}
