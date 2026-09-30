import { authResponse, protectedBody } from "@/server/auth-http";
import { inventoryFailure } from "@/server/inventory";
import { checkoutQuote } from "@/server/checkout-quote";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { return authResponse(await checkoutQuote(await protectedBody(request, 32768))); }
  catch (error) { return inventoryFailure(error); }
}
