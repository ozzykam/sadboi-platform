import { authResponse, protectedBody } from "@/server/auth-http";
import {
  inventoryStaff,
  inventoryFailure,
  inventoryCatalog,
  reservationCatalog,
  saveReservation,
  metadataResource,
  saveMetadata,
  postMovement,
  dispatchStock,
  receiveTransfer,
  postStockCount,
  saveStockPolicy,
} from "@/server/inventory";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await inventoryStaff();
    return authResponse(
      new URL(request.url).searchParams.has("reservations")
        ? await reservationCatalog()
        : await inventoryCatalog(),
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
async function write(request: Request, editing: boolean) {
  try {
    const staff = await inventoryStaff(true),
      body = await protectedBody(request, 16384);
    const action = new URL(request.url).searchParams.get("action") ?? "";
    if (action === "reservation")
      return authResponse(
        await saveReservation(body, staff, editing),
        editing ? 200 : 201,
      );
    if (metadataResource(action))
      return authResponse(
        await saveMetadata(action, body, staff, editing),
        editing ? 200 : 201,
      );
    if (!editing && action === "movement")
      return authResponse(await postMovement(body, staff), 201);
    if (!editing && action === "dispatch")
      return authResponse(await dispatchStock(body, staff), 201);
    if (!editing && action === "receipt")
      return authResponse(await receiveTransfer(body, staff), 201);
    if (!editing && action === "stocktake")
      return authResponse(await postStockCount(body, staff), 201);
    if (!editing && action === "stock-policy")
      return authResponse(await saveStockPolicy(body, staff), 201);
    return authResponse({ error: "Unknown inventory action." }, 400);
  } catch (error) {
    return inventoryFailure(error);
  }
}
export async function POST(request: Request) {
  return write(request, false);
}
export async function PATCH(request: Request) {
  return write(request, true);
}
