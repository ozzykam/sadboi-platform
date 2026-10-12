import { authResponse, protectedBody } from "@/server/auth-http";
import { contactsStaff } from "@/server/contacts";
import { inventoryFailure } from "@/server/inventory";
import { eventDetail, eventDirectory, saveEvent } from "@/server/events";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const staff = await contactsStaff(),
      id = new URL(request.url).searchParams.get("id");
    return authResponse(
      id
        ? await eventDetail(id, staff)
        : { events: await eventDirectory(staff) },
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const staff = await contactsStaff();
    return authResponse(
      await saveEvent(await protectedBody(request, 196608), staff),
      201,
    );
  } catch (error) {
    return inventoryFailure(error);
  }
}
